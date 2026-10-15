import {
    SOCKET_EVENTS,
    type ConnectionReadyPayload,
    type PlayerInput,
    type PlayerInputPayload,
    type PlayerJoinedPayload,
    type PlayerLeftPayload,
    type RoomErrorPayload,
    type RoomStatePayload
} from '@hackatec/shared';
import type { Server } from 'socket.io';
import { createMovementRuntime, acceptMovementInput, advanceMovement, type MovementRuntime } from '../game/movement.js';
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

        socket.on(SOCKET_EVENTS.ROOM_JOIN, (rawPayload: unknown) =>
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

            movement.set(socket.id, createMovementRuntime());
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

        socket.on('disconnect', (reason) => {
            movement.delete(socket.id);
        {
            const left = roomManager.leave(socket.id);

            if (left)
            {
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
