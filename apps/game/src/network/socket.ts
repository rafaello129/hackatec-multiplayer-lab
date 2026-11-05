import { io, type Socket } from 'socket.io-client';
import { normalizeServerUrl } from './config';

const browserHostname = typeof window === 'undefined' ? undefined : window.location.hostname;
const browserProtocol = typeof window === 'undefined' ? 'http:' : window.location.protocol;
export const serverUrl = normalizeServerUrl(
    import.meta.env.VITE_SERVER_URL,
    browserHostname,
    browserProtocol
);

let socket: Socket | undefined;

export function getSocket(): Socket
{
    if (!socket)
    {
        socket = io(serverUrl, {
            autoConnect: false,
            transports: ['websocket', 'polling'],
            withCredentials: true
        });
    }

    return socket;
}
