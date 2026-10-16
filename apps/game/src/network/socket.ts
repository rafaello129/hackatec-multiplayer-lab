import { io, type Socket } from 'socket.io-client';
import { normalizeServerUrl } from './config';
import { SOCKET_EVENTS, type ConnectionReadyPayload } from '@hackatec/shared';

export const serverUrl = normalizeServerUrl(import.meta.env.VITE_SERVER_URL);

let socket: Socket | undefined;
const sessionKey = `hackatec:session:${serverUrl}`;
let sessionToken: string | undefined;
try { sessionToken = sessionStorage.getItem(sessionKey) ?? undefined; } catch { /* Memory fallback. */ }

export function leaveSession(): void {
    sessionToken = undefined;
    try { sessionStorage.removeItem(sessionKey); } catch { /* Storage may be disabled. */ }
    socket?.disconnect();
}

export function getSocket(): Socket
{
    if (!socket)
    {
        socket = io(serverUrl, {
            autoConnect: false,
            auth: callback => callback({ sessionToken }),
            transports: ['websocket', 'polling']
        });
        socket.on(SOCKET_EVENTS.CONNECTION_READY, (ready: ConnectionReadyPayload) => {
            sessionToken = ready.sessionToken;
            try {
                if (sessionToken) sessionStorage.setItem(sessionKey, sessionToken);
                else sessionStorage.removeItem(sessionKey);
            } catch { /* Automatic reconnection still works in memory. */ }
        });
    }

    return socket;
}
