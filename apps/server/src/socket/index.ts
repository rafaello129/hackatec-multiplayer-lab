import { SOCKET_EVENTS, type ConnectionReadyPayload } from '@hackatec/shared';
import type { Server } from 'socket.io';

export function registerSocketHandlers(io: Server)
{
    io.on('connection', (socket) =>
    {
        console.log(`[socket] connected: ${socket.id}`);

        const payload: ConnectionReadyPayload = {
            message: 'connected',
            socketId: socket.id
        };

        socket.emit(SOCKET_EVENTS.CONNECTION_READY, payload);

        socket.on('disconnect', (reason) =>
        {
            console.log(`[socket] disconnected: ${socket.id} (${reason})`);
        });
    });
}
