import { io } from 'socket.io-client';
import { normalizeServerUrl } from './config';

export const serverUrl = normalizeServerUrl(import.meta.env.VITE_SERVER_URL);

export function createSocket()
{
    return io(serverUrl, {
        autoConnect: false,
        transports: ['websocket', 'polling']
    });
}
