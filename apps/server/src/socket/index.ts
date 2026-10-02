import {
    SOCKET_EVENTS,
    type ConnectionReadyPayload,
    type JoinRoomPayload,
    type PlayerJoinedPayload,
    type PlayerLeftPayload,
    type RoomErrorPayload,
    type RoomStatePayload
} from '@hackatec/shared';
import type { Server } from 'socket.io';
import { RoomManager } from '../rooms/RoomManager.js';

function socketRoom(roomId: string): string
{
    return 'room:' + roomId;
}

export function registerSocketHandlers(
    io: Server,
    roomManager = new RoomManager()
)
{
    io.on('connection', (socket) =>
    {
        console.log('[socket] connected: ' + socket.id);

        const payload: ConnectionReadyPayload = {
            message: 'connected',
            socketId: socket.id
        };

        socket.emit(SOCKET_EVENTS.CONNECTION_READY, payload);

        socket.on(SOCKET_EVENTS.ROOM_JOIN, (rawPayload: JoinRoomPayload) =>
        {
            const roomId = typeof rawPayload?.roomId === 'string'
                ? rawPayload.roomId.trim()
                : '';
            const playerName = typeof rawPayload?.playerName === 'string'
                ? rawPayload.playerName
                : undefined;
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
                    '[room] ' + socket.id + ' left ' + result.previous.roomId
                );
            }

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
                    '[room] ' + socket.id + ' joined ' + result.roomId +
                    ' as ' + result.player.name
                );
            }
        });

        socket.on('disconnect', (reason) =>
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
                    '[room] ' + socket.id + ' left ' + left.roomId
                );
            }

            console.log(
                '[socket] disconnected: ' + socket.id + ' (' + reason + ')'
            );
        });
    });

    return roomManager;
}
