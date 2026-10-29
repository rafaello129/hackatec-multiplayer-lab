import {
    SOCKET_EVENTS,
    type ConnectionReadyPayload,
    type PlayerInput,
    type PlayerInputPayload,
    type ProfileUpdatePayload,
    type PlayerJoinedPayload,
    type PlayerLeftPayload,
    type RoomErrorPayload,
    type RoomStatePayload
} from '@hackatec/shared';
import type { Server } from 'socket.io';
import { createMovementRuntime, acceptMovementInput, advanceMovement, type MovementRuntime } from '../game/movement.js';
import { CombatManager } from '../game/CombatManager.js';
import { AccountStore, normalizeUsername, SESSION_COOKIE, type Account } from '../auth/AccountStore.js';
import { getAllowedOrigins } from '../config/env.js';
import { RoomManager } from '../rooms/RoomManager.js';
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
    const identities = new Map<string, string>();

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
            const map = roomManager.getMap(roomId);
            if (!map) continue;
            const wasDashing = player.isDashing;
            const moved = advanceMovement(player, state, map, 50, now);
            if (moved || wasDashing !== player.isDashing) {
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player });
            }
            rooms.add(roomId);
        }
        for (const roomId of rooms) {
            const map = roomManager.getMap(roomId);
            if (!map) { rooms.delete(roomId); continue; }
            const players = roomManager.getPlayers(roomId);
            const projectiles = combat.step(roomId, players, map, 50, now);
            io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.COMBAT_STATE, { players, projectiles });
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
            result.player.appearance = profile.appearance;
            if (result.previous)
            {
                socket.leave(socketRoom(result.previous.roomId));

                const leftPayload: PlayerLeftPayload = {
                    playerId: result.previous.player.id
                };

                io.to(socketRoom(result.previous.roomId))
                    .emit(SOCKET_EVENTS.PLAYER_LEFT, leftPayload);

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

            const statePayload: RoomStatePayload = {
                roomId: result.roomId,
                selfId: socket.id,
                players: result.players,
                map: result.map
            };

            socket.emit(SOCKET_EVENTS.ROOM_STATE, statePayload);

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

        socket.on(SOCKET_EVENTS.PLAYER_INPUT, (raw: unknown) => {
            if (!roomManager.getRoomId(socket.id)) return;
            if (!raw || typeof raw !== 'object') return;
            const input = (raw as Partial<PlayerInputPayload>).input;
            if (!input || typeof input !== 'object') return;
            const keys: (keyof PlayerInput)[] = ['up', 'down', 'left', 'right', 'dash'];
            if (!keys.every(key => typeof input[key] === 'boolean')) return;
            const state = movement.get(socket.id);
            if (state) acceptMovementInput(state, input, Date.now(), roomManager.getPlayer(socket.id));
        });

        socket.on(SOCKET_EVENTS.PLAYER_SHOOT, (payload: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            const player = roomManager.getPlayer(socket.id);
            if (roomId && player) combat.shoot(roomId, player, payload, Date.now());
        });

        socket.on('disconnect', (reason) => {
            movement.delete(socket.id);
            identities.delete(socket.id);
            const left = roomManager.leave(socket.id);

            if (left)
            {
                combat.leave(left.roomId, socket.id, !roomManager.hasRoom(left.roomId));
                if (!roomManager.hasRoom(left.roomId)) rooms.delete(left.roomId);
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
