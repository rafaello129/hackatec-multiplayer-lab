import {
    SOCKET_EVENTS,
    type ConnectionReadyPayload,
    type PlayerInput,
    type PlayerInputPayload,
    type ProfileUpdatePayload,
    type PlayerJoinedPayload,
    type PlayerLeftPayload,
    type RoomErrorPayload,
    type RoomStatePayload,
    type GameMode,
    type MatchVotePayload,
    type HostStartMatchPayload
} from '@hackatec/shared';
import type { Server } from 'socket.io';
import { createMovementRuntime, acceptMovementInput, advanceMovement, type MovementRuntime } from '../game/movement.js';
import { CombatManager } from '../game/CombatManager.js';
import { AccountStore, normalizeUsername, SESSION_COOKIE, type Account } from '../auth/AccountStore.js';
import { getAllowedOrigins } from '../config/env.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { MatchManager } from '../rooms/MatchManager.js';
import { parseJoinPayload } from './validateJoinPayload.js';

function socketRoom(roomId: string): string
{
    return `room:${roomId}`;
}

export function registerSocketHandlers(
    io: Server,
    roomManager = new RoomManager(),
    accounts = new AccountStore(),
    corsOrigin = '*'
)
{
    const movement = new Map<string, MovementRuntime>();
    const combat = new CombatManager();
    const matches = new MatchManager();
    const identities = new Map<string, string>();
    const laserPermissions = new Map<string, boolean>();
    let lastWeaponStateSyncAt = 0;

    const syncMatchRoom = (roomId: string, now: number): void => {
        const players = roomManager.getPlayers(roomId);
        const accountIds = new Map<string, string>();
        for (const player of players) accountIds.set(player.id, identities.get(player.id) ?? player.id);
        matches.syncRoom(roomId, players, roomManager.getHostId(roomId), now, accountIds);
    };

    const resetRoomForMatch = (roomId: string): void => {
        const reset = roomManager.resetForMatch(roomId);
        if (!reset) return;
        combat.resetRoom(roomId);
        io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.ROOM_MAP, reset.map);
        io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.COMBAT_STATE, { players: reset.players, projectiles: [], beams: [], explosions: [] });
        const mode = matches.getState(roomId)?.mode ?? null;
        for (const player of reset.players) {
            const weaponState = combat.initializePlayer(roomId, player, laserPermissions.get(player.id) === true, mode);
            io.to(player.id).emit(SOCKET_EVENTS.WEAPON_STATE, weaponState);
        }
        for (const [socketId] of movement) {
            if (roomManager.getRoomId(socketId) === roomId) movement.set(socketId, createMovementRuntime());
        }
    };

    io.use((socket, next) => {
        const origin = socket.handshake.headers.origin;
        const allowedOrigins = getAllowedOrigins(corsOrigin);
        if (process.env.NODE_ENV === 'production' && (!origin || allowedOrigins === '*')) {
            next(new Error('ORIGIN_NOT_ALLOWED'));
            return;
        }
        if (origin && allowedOrigins !== '*' && !allowedOrigins.includes(origin)) {
            next(new Error('ORIGIN_NOT_ALLOWED'));
            return;
        }
        const cookieHeader = socket.handshake.headers.cookie;
        const token = cookieHeader?.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
        let decodedToken: string | undefined;
        try { decodedToken = token ? decodeURIComponent(token) : undefined; } catch { decodedToken = undefined; }
        const account = accounts.getAccountBySessionToken(decodedToken);
        if (!account) {
            next(new Error('UNAUTHORIZED'));
            return;
        }
        socket.data.account = account;
        socket.data.sessionToken = decodedToken;
        next();
    });
    const rooms = new Set<string>();
    const tick = setInterval(() => {
        const now = Date.now();

        for (const [socketId, state] of movement) {
            const player = roomManager.getPlayer(socketId);
            const roomId = roomManager.getRoomId(socketId);
            if (!player || !roomId) { movement.delete(socketId); continue; }
            rooms.add(roomId);
            if (player.spectator || !matches.isPlaying(roomId)) continue;
            const map = roomManager.getMap(roomId);
            if (!map) continue;
            const wasDashing = player.isDashing;
            const moved = advanceMovement(player, state, map, 50, now);
            if (moved || wasDashing !== player.isDashing) {
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player });
            }
        }

        for (const roomId of rooms) {
            if (!roomManager.hasRoom(roomId)) {
                rooms.delete(roomId);
                continue;
            }
            syncMatchRoom(roomId, now);
        }

        for (const transition of matches.advance(now, id => roomManager.getPlayers(id))) {
            if (transition.resetPlayers) resetRoomForMatch(transition.roomId);
        }

        for (const roomId of rooms) {
            const map = roomManager.getMap(roomId);
            if (!map) { rooms.delete(roomId); continue; }
            if (!matches.isPlaying(roomId)) continue;
            const players = roomManager.getPlayers(roomId);
            const mode = matches.getState(roomId)?.mode ?? null;
            const snapshot = combat.step(roomId, players, map, 50, now, mode ?? 'classic');
            io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.COMBAT_STATE, {
                players,
                projectiles: snapshot.projectiles,
                beams: snapshot.beams,
                explosions: snapshot.explosions
            });
            if (now - lastWeaponStateSyncAt >= 100) {
                lastWeaponStateSyncAt = now;
                for (const player of players) {
                    io.to(player.id).emit(SOCKET_EVENTS.WEAPON_STATE, combat.getWeaponState(roomId, player.id, now, mode));
                }
            }
        }

        for (const state of matches.takeUpdates()) {
            io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
        }
    }, 50);
    tick.unref?.();

    io.on('connection', (socket) =>
    {
        socket.use((_packet, next) => {
            const sessionToken = socket.data.sessionToken as string | undefined;
            if (!accounts.getAccountBySessionToken(sessionToken)) {
                socket.disconnect(true);
                next(new Error('UNAUTHORIZED'));
                return;
            }
            next();
        });

        console.log(`[socket] connected: ${socket.id}`);

        const payload: ConnectionReadyPayload = {
            message: 'connected',
            socketId: socket.id
        };

        socket.emit(SOCKET_EVENTS.CONNECTION_READY, payload);

        socket.on(SOCKET_EVENTS.ROOM_JOIN, async (rawPayload: unknown) =>
        {
            const parsed = parseJoinPayload(rawPayload);

            if (!parsed.ok)
            {
                const errorPayload: RoomErrorPayload = {
                    code: 'INVALID_ROOM',
                    message: parsed.message
                };
                socket.emit(SOCKET_EVENTS.ROOM_ERROR, errorPayload);
                return;
            }

            const account = socket.data.account as Account | undefined;
            if (!account) {
                socket.emit(SOCKET_EVENTS.ROOM_ERROR, { code: 'AUTH_REQUIRED', message: 'Inicia sesión para entrar a una sala.' });
                return;
            }
            const roomId = parsed.value.roomId.trim();
            const previousRoomId = roomManager.getRoomId(socket.id);
            const profile = accounts.getAccountById(account.id);
            if (!profile) {
                socket.emit(SOCKET_EVENTS.ROOM_ERROR, { code: 'AUTH_REQUIRED', message: 'La sesión ya no es válida.' });
                return;
            }
            const result = roomManager.join(roomId, socket.id, account.username);

            if (!result.ok)
            {
                const errorPayload: RoomErrorPayload = {
                    code: result.code,
                    message: result.message
                };

                socket.emit(SOCKET_EVENTS.ROOM_ERROR, errorPayload);
                return;
            }

            if (!socket.connected) return;
            identities.set(socket.id, account.id);
            const canUseLaser = normalizeUsername(account.username) === 'gueta';
            laserPermissions.set(socket.id, canUseLaser);
            const initialWeaponState = combat.initializePlayer(result.roomId, result.player, canUseLaser, matches.getState(result.roomId)?.mode ?? null);
            result.player.appearance = profile.appearance;
            if (result.previous)
            {
                socket.leave(socketRoom(result.previous.roomId));

                const leftPayload: PlayerLeftPayload = {
                    playerId: result.previous.player.id
                };

                io.to(socketRoom(result.previous.roomId))
                    .emit(SOCKET_EVENTS.PLAYER_LEFT, leftPayload);

                syncMatchRoom(result.previous.roomId, Date.now());
                for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
                if (result.previous.hostId) io.to(socketRoom(result.previous.roomId)).emit(SOCKET_EVENTS.ROOM_HOST_CHANGED, { hostId: result.previous.hostId });
                console.log(
                    `[room] ${socket.id} left ${result.previous.roomId}`
                );
            }

            if (previousRoomId && previousRoomId !== result.roomId) {
                combat.leave(previousRoomId, socket.id, !roomManager.hasRoom(previousRoomId));
                if (!roomManager.hasRoom(previousRoomId)) rooms.delete(previousRoomId);
            }
            if (!movement.has(socket.id) || previousRoomId !== result.roomId) movement.set(socket.id, createMovementRuntime());
            rooms.add(result.roomId);
            socket.join(socketRoom(result.roomId));

            syncMatchRoom(result.roomId, Date.now());

            const statePayload: RoomStatePayload = {
                roomId: result.roomId,
                selfId: socket.id,
                players: result.players,
                map: result.map,
                hostId: result.hostId
            };

            socket.emit(SOCKET_EVENTS.ROOM_STATE, statePayload);
            socket.emit(SOCKET_EVENTS.MATCH_STATE, matches.getState(result.roomId));
            socket.emit(SOCKET_EVENTS.WEAPON_STATE, initialWeaponState);
            for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);

            if (previousRoomId !== result.roomId)
            {
                const joinedPayload: PlayerJoinedPayload = {
                    player: result.player
                };

                socket.to(socketRoom(result.roomId))
                    .emit(SOCKET_EVENTS.PLAYER_JOINED, joinedPayload);

                console.log(
                    `[room] ${socket.id} joined ${result.roomId} as ${result.player.name}`
                );
            }
        });

        socket.on(SOCKET_EVENTS.PROFILE_SET, async (raw: unknown) => {
            const player = roomManager.getPlayer(socket.id);
            const roomId = roomManager.getRoomId(socket.id);
            const userId = identities.get(socket.id);
            if (!player || !roomId || !userId || !raw || typeof raw !== 'object') return;
            const value = raw as ProfileUpdatePayload;
            const username = value.username;
            const appearance = value.appearance;
            const currentAccount = accounts.getAccountById(userId);
            if (currentAccount?.isOwner && username !== undefined &&
                (typeof username !== 'string' || normalizeUsername(username.trim()) !== 'gueta')) {
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: false, message: 'El nombre Gueta está reservado para esta cuenta.' });
                return;
            }
            if (username !== undefined && (typeof username !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(username.trim()))) {
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: false, message: 'Username inválido (3-16 caracteres)' });
                return;
            }
            if (appearance !== undefined && (
                !appearance || typeof appearance !== 'object' ||
                (appearance.mode !== 'color' && appearance.mode !== 'skin') ||
                typeof appearance.colorHex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(appearance.colorHex) ||
                (appearance.mode === 'skin' && (!appearance.skin || !/^\/skins\/[a-f0-9-]+\.(png|jpg|webp)$/.test(appearance.skin.url)))
            )) {
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: false, message: 'Apariencia inválida' });
                return;
            }
            try {
                const account = accounts.updateProfile(userId, {
                    ...(typeof username === 'string' ? { username: username.trim() } : {}),
                    ...(appearance ? { appearance } : {})
                });
                if (!account || !socket.connected || roomManager.getPlayer(socket.id) !== player || identities.get(socket.id) !== userId) return;
                player.name = account.username;
                player.appearance = account.appearance;
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player });
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: true, message: 'Perfil guardado' });
            } catch (error) {
                const message = error instanceof Error && error.message.includes('UNIQUE constraint failed: accounts.username_key')
                    ? 'Ese nombre de usuario ya está en uso.'
                    : 'No se pudo guardar el perfil.';
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: false, message });
            }
        });

        socket.on(SOCKET_EVENTS.MATCH_VOTE, (raw: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            if (!roomId || !raw || typeof raw !== 'object') return;
            const mode = (raw as Partial<MatchVotePayload>).mode;
            if (typeof mode !== 'string' || mode.length > 32) return;
            const accountId = identities.get(socket.id);
            if (!accountId) return;
            const result = matches.vote(roomId, socket.id, accountId, mode as GameMode, Date.now());
            socket.emit(SOCKET_EVENTS.MATCH_ACTION_RESULT, result);
            for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
        });

        socket.on(SOCKET_EVENTS.MATCH_HOST_START, (raw: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            if (!roomId || !raw || typeof raw !== 'object') return;
            const mode = (raw as Partial<HostStartMatchPayload>).mode;
            if (typeof mode !== 'string' || mode.length > 32) return;
            const result = matches.forceStart(roomId, socket.id, mode as GameMode, Date.now());
            if (result.ok) resetRoomForMatch(roomId);
            socket.emit(SOCKET_EVENTS.MATCH_ACTION_RESULT, result);
            for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
        });

        socket.on(SOCKET_EVENTS.MATCH_HOST_STOP, () => {
            const roomId = roomManager.getRoomId(socket.id);
            if (!roomId) return;
            const result = matches.stop(roomId, socket.id);
            if (result.ok) {
                combat.resetRoom(roomId);
                const players = roomManager.getPlayers(roomId);
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.COMBAT_STATE, {
                    players,
                    projectiles: [],
                    beams: [],
                    explosions: []
                });
                for (const player of players) {
                    const weaponState = combat.initializePlayer(roomId, player, laserPermissions.get(player.id) === true, matches.getState(roomId)?.mode ?? null);
                    io.to(player.id).emit(SOCKET_EVENTS.WEAPON_STATE, weaponState);
                }
            }
            socket.emit(SOCKET_EVENTS.MATCH_ACTION_RESULT, result);
            for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
        });

        socket.on(SOCKET_EVENTS.PLAYER_INPUT, (raw: unknown) => {
            const activeRoom = roomManager.getRoomId(socket.id);
            const activePlayer = roomManager.getPlayer(socket.id);
            if (!activeRoom || !matches.isPlaying(activeRoom) || activePlayer?.spectator) return;
            if (!raw || typeof raw !== 'object') return;
            const input = (raw as Partial<PlayerInputPayload>).input;
            if (!input || typeof input !== 'object') return;
            const keys: (keyof PlayerInput)[] = ['up', 'down', 'left', 'right', 'dash'];
            if (!keys.every(key => typeof input[key] === 'boolean')) return;
            const state = movement.get(socket.id);
            if (state) acceptMovementInput(state, input, Date.now(), roomManager.getPlayer(socket.id));
        });

        socket.on(SOCKET_EVENTS.WEAPON_SELECT, (raw: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            const player = roomManager.getPlayer(socket.id);
            if (!roomId || !player || player.spectator || !matches.isPlaying(roomId) ||
                !raw || typeof raw !== 'object' || Array.isArray(raw)) return;
            const slot = (raw as { slot?: unknown }).slot;
            if (typeof slot !== 'number') return;
            const result = combat.selectWeapon(roomId, player, slot, matches.getState(roomId)?.mode ?? null, Date.now());
            socket.emit(SOCKET_EVENTS.WEAPON_RESULT, result);
            socket.emit(SOCKET_EVENTS.WEAPON_STATE, combat.getWeaponState(roomId, socket.id, Date.now(), matches.getState(roomId)?.mode ?? null));
        });

        socket.on(SOCKET_EVENTS.WEAPON_FIRE, (payload: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            const player = roomManager.getPlayer(socket.id);
            if (roomId && player && !player.spectator && player.alive !== false && matches.isPlaying(roomId)) {
                combat.setFireIntent(roomId, player, payload, Date.now());
            }
        });

        // Compatibility for clients that still send player:shoot; the server still chooses the active slot.
        socket.on(SOCKET_EVENTS.PLAYER_SHOOT, (payload: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            const player = roomManager.getPlayer(socket.id);
            if (!roomId || !player || player.spectator || player.alive === false || !matches.isPlaying(roomId) ||
                !payload || typeof payload !== 'object') return;
            const angle = (payload as { angle?: unknown }).angle;
            if (typeof angle === 'number') combat.setFireIntent(roomId, player, { angle, firing: true }, Date.now());
        });

        socket.on('disconnect', (reason) => {
            movement.delete(socket.id);
            identities.delete(socket.id);
            laserPermissions.delete(socket.id);
            const left = roomManager.leave(socket.id);

            if (left)
            {
                combat.leave(left.roomId, socket.id, !roomManager.hasRoom(left.roomId));
                if (!roomManager.hasRoom(left.roomId)) rooms.delete(left.roomId);
                syncMatchRoom(left.roomId, Date.now());
                for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
                if (left.hostId) io.to(socketRoom(left.roomId)).emit(SOCKET_EVENTS.ROOM_HOST_CHANGED, { hostId: left.hostId });
                const leftPayload: PlayerLeftPayload = {
                    playerId: left.player.id
                };

                io.to(socketRoom(left.roomId))
                    .emit(SOCKET_EVENTS.PLAYER_LEFT, leftPayload);

                console.log(
                    `[room] ${socket.id} left ${left.roomId}`
                );
            }

            console.log(`[socket] disconnected: ${socket.id} (${reason})`);
        });
    });

    return roomManager;
}
