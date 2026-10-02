import { io, type Socket } from 'socket.io-client';
import { normalizeServerUrl } from './config';

export const serverUrl = normalizeServerUrl(import.meta.env.VITE_SERVER_URL);

let socket: Socket | undefined;

export function getSocket(): Socket
{
    if (!socket)
    {
        socket = io(serverUrl, {
            autoConnect: false,
            transports: ['websocket', 'polling']
        });
    }

    return socket;
}
