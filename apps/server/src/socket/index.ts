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

function socketRoom(roomId: string): string
{
    return `room:${roomId}`;
}

export function registerSocketHandlers(
    io: Server,
    roomManager = new RoomManager()
)
{
    const movement = new Map<string, MovementRuntime>();
    const combat = new CombatManager();
    const profiles = new ProfileStore();
    const identities = new Map<string,string>();
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

            const roomId = parsed.value.roomId.trim();
            const playerName = parsed.value.playerName;
            const previousRoomId = roomManager.getRoomId(socket.id);
            const suppliedId = (rawPayload as { profileId?: unknown }).profileId;
            const profileId = typeof suppliedId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(suppliedId) ? suppliedId : socket.id;
            let profile: Profile;
            try { profile = await profiles.get(profileId); }
            catch { profile = { appearance: { mode: 'color' as const, colorHex: '#60A5FA' } }; }
            const result = roomManager.join(roomId, socket.id, playerName);

            if (!result.ok)
            {
                const errorPayload: RoomErrorPayload = {
                    code: result.code,
                    message: result.message
                };

                socket.emit(SOCKET_EVENTS.ROOM_ERROR, errorPayload);
                return;
            }

            identities.set(socket.id, profileId);
            result.player.appearance = profile.appearance;
            if (profile.username) result.player.name = profile.username;
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
            const id = identities.get(socket.id);
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
                if (saved.username) player.name = saved.username;
                player.appearance = saved.appearance;
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player });
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, {ok:true,message:'Perfil guardado'});
            } catch (error) {
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, {ok:false,message:error instanceof Error ? error.message : 'No se pudo guardar'});
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
            if (state) acceptMovementInput(state, input, Date.now());
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
