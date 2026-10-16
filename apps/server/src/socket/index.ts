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
import { ProfileStore, type Profile } from '../profiles/ProfileStore.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { parseJoinPayload } from './validateJoinPayload.js';
import { SessionStore } from './SessionStore.js';

function socketRoom(roomId: string): string
{
    return `room:${roomId}`;
}

export function registerSocketHandlers(
    io: Server,
    roomManager = new RoomManager(),
    sessions = new SessionStore()
)
{
    const movement = new Map<string, MovementRuntime>();
    const combat = new CombatManager();
    const profiles = new ProfileStore();
    const identities = new Map<string,string>();
    const rooms = new Set<string>();
    const removePlayer = (playerId: string) => {
        movement.delete(playerId);
        identities.delete(playerId);
        sessions.remove(playerId);
        const left = roomManager.leave(playerId);
        if (!left) return;
        combat.leave(left.roomId, playerId, !roomManager.hasRoom(left.roomId));
        if (!roomManager.hasRoom(left.roomId)) rooms.delete(left.roomId);
        const payload: PlayerLeftPayload = { playerId };
        io.to(socketRoom(left.roomId)).emit(SOCKET_EVENTS.PLAYER_LEFT, payload);
    };
    const tick = setInterval(() => {
        const now = Date.now();
        for (const playerId of sessions.expired(now)) removePlayer(playerId);
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
    io.engine.on('close', () => clearInterval(tick));

    io.on('connection', (socket) =>
    {
        const { session, recovered } = sessions.open(socket.handshake.auth?.sessionToken, socket.id, Date.now());
        const playerId = session.playerId;
        const retained = roomManager.getPlayer(playerId);
        const retainedRoom = roomManager.getRoomId(playerId);
        if (recovered && retained && retainedRoom) {
            retained.connected = true;
            socket.join(socketRoom(retainedRoom));
            socket.to(socketRoom(retainedRoom)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player: retained });
        }
        let joinAttempt = 0;
        console.log(`[socket] connected: ${playerId}`);

        const payload: ConnectionReadyPayload = {
            message: 'connected',
            socketId: socket.id,
            sessionToken: session.token,
            recovered: recovered && Boolean(retained),
            recoveryWindowMs: sessions.windowMs
        };

        socket.emit(SOCKET_EVENTS.CONNECTION_READY, payload);

        socket.on(SOCKET_EVENTS.ROOM_JOIN, async (rawPayload: unknown) =>
        {
            const attempt = ++joinAttempt;
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

            const roomId = parsed.value.roomId.trim();
            const playerName = parsed.value.playerName;
            const suppliedId = (rawPayload as { profileId?: unknown }).profileId;
            const profileId = identities.get(playerId) ??
                (typeof suppliedId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(suppliedId) ? suppliedId : playerId);
            let profile: Profile;
            try { profile = await profiles.get(profileId); }
            catch { profile = { appearance: { mode: 'color' as const, colorHex: '#60A5FA' } }; }
            if (!socket.connected || session.socketId !== socket.id || attempt !== joinAttempt) return;
            const previousRoomId = roomManager.getRoomId(playerId);
            const result = roomManager.join(roomId, playerId, playerName);

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
            identities.set(playerId, profileId);
            result.player.connected = true;
            if (previousRoomId !== roomId) {
                result.player.appearance = profile.appearance;
                if (!playerName?.trim() && profile.username) result.player.name = profile.username;
            }
            if (result.previous)
            {
                socket.leave(socketRoom(result.previous.roomId));

                const leftPayload: PlayerLeftPayload = {
                    playerId: result.previous.player.id
                };

                io.to(socketRoom(result.previous.roomId))
                    .emit(SOCKET_EVENTS.PLAYER_LEFT, leftPayload);

                console.log(
                    `[room] ${playerId} left ${result.previous.roomId}`
                );
            }

            if (previousRoomId && previousRoomId !== result.roomId) {
                combat.leave(previousRoomId, playerId, !roomManager.hasRoom(previousRoomId));
                if (!roomManager.hasRoom(previousRoomId)) rooms.delete(previousRoomId);
            }
            if (!movement.has(playerId) || previousRoomId !== result.roomId) movement.set(playerId, createMovementRuntime());
            rooms.add(result.roomId);
            socket.join(socketRoom(result.roomId));

            const statePayload: RoomStatePayload = {
                roomId: result.roomId,
                selfId: playerId,
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
                    `[room] ${playerId} joined ${result.roomId} as ${result.player.name}`
                );
            }
        });

        socket.on(SOCKET_EVENTS.PROFILE_SET, async (raw: unknown) => {
            const player = roomManager.getPlayer(playerId);
            const roomId = roomManager.getRoomId(playerId);
            const id = identities.get(playerId);
            if (!player || !roomId || !id || !raw || typeof raw !== 'object') return;
            const value = raw as ProfileUpdatePayload;
            const username = value.username;
            const appearance = value.appearance;
            if (username !== undefined && (typeof username !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(username))) {
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok:false, message:'Username inválido (3-16 caracteres)' }); return;
            }
            if (appearance !== undefined && (
                !appearance || typeof appearance !== 'object' ||
                (appearance.mode !== 'color' && appearance.mode !== 'skin') ||
                typeof appearance.colorHex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(appearance.colorHex) ||
                (appearance.mode === 'skin' && (!appearance.skin || !/^\/skins\/[a-f0-9-]+\.(png|jpg|webp)$/.test(appearance.skin.url)))
            )) { socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok:false, message:'Apariencia inválida' }); return; }
            try {
                const saved = await profiles.update(id, { ...(username ? { username } : {}), ...(appearance ? { appearance } : {}) });
                if (!socket.connected || roomManager.getPlayer(playerId) !== player || identities.get(playerId) !== id) return;
                if (saved.username) player.name = saved.username;
                player.appearance = saved.appearance;
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player });
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, {ok:true,message:'Perfil guardado'});
            } catch (error) {
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, {ok:false,message:error instanceof Error ? error.message : 'No se pudo guardar'});
            }
        });

        socket.on(SOCKET_EVENTS.PLAYER_INPUT, (raw: unknown) => {
            if (!roomManager.getRoomId(playerId)) return;
            if (!raw || typeof raw !== 'object') return;
            const input = (raw as Partial<PlayerInputPayload>).input;
            if (!input || typeof input !== 'object') return;
            const keys: (keyof PlayerInput)[] = ['up', 'down', 'left', 'right', 'dash'];
            if (!keys.every(key => typeof input[key] === 'boolean')) return;
            const state = movement.get(playerId);
            if (state) acceptMovementInput(state, input, Date.now(), roomManager.getPlayer(playerId));
        });

        socket.on(SOCKET_EVENTS.PLAYER_SHOOT, (payload: unknown) => {
            const roomId = roomManager.getRoomId(playerId);
            const player = roomManager.getPlayer(playerId);
            if (roomId && player) combat.shoot(roomId, player, payload, Date.now());
        });

        socket.on('disconnect', (reason) => {
            if (session.socketId !== socket.id) return;
            const player = roomManager.getPlayer(playerId);
            const roomId = roomManager.getRoomId(playerId);
            const temporary = ['transport close', 'transport error', 'ping timeout', 'forced close'].includes(reason);
            if (temporary && player && roomId && sessions.suspend(playerId, socket.id, Date.now())) {
                player.connected = false;
                player.isDashing = false;
                const state = movement.get(playerId);
                if (state) {
                    state.input = { up:false, down:false, left:false, right:false, dash:false };
                    state.lastInputAt = 0;
                    state.dashUntil = 0;
                }
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player });
            } else {
                removePlayer(playerId);
            }

            console.log(`[socket] disconnected: ${playerId} (${reason})`);
        });
    });

    return roomManager;
}
