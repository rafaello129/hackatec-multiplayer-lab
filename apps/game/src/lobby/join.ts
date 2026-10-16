import { SOCKET_EVENTS, type JoinRoomPayload, type RoomErrorPayload, type RoomStatePayload } from '@hackatec/shared';
import type { Socket } from 'socket.io-client';

/** One attempt, with bounded waiting and no handlers retained by the lobby. */
export function joinFromLobby(socket: Socket, payload: JoinRoomPayload): Promise<RoomStatePayload> {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            clearTimeout(timer);
            socket.off('connect', send);
            socket.off('connect_error', failed);
            socket.off('disconnect', disconnected);
            socket.off(SOCKET_EVENTS.ROOM_STATE, ready);
            socket.off(SOCKET_EVENTS.ROOM_ERROR, roomError);
        };
        const failed = () => fail('No se pudo conectar. Comprueba la conexión e inténtalo de nuevo.');
        const disconnected = () => fail('Se perdió la conexión al entrar. Inténtalo de nuevo.');
        const fail = (message: string) => {
            cleanup();
            socket.disconnect();
            reject(new Error(message));
        };
        const ready = (state: RoomStatePayload) => {
            if (state.roomId !== payload.roomId) return;
            cleanup();
            resolve(state);
        };
        const roomError = (error: RoomErrorPayload) => fail(error.message);
        const send = () => socket.emit(SOCKET_EVENTS.ROOM_JOIN, payload);
        const timer = globalThis.setTimeout(() => fail('El servidor tardó demasiado. Inténtalo de nuevo.'), 12000);
        socket.on('connect', send);
        socket.on('connect_error', failed);
        socket.on('disconnect', disconnected);
        socket.on(SOCKET_EVENTS.ROOM_STATE, ready);
        socket.on(SOCKET_EVENTS.ROOM_ERROR, roomError);
        if (socket.connected) send();
        else socket.connect();
    });
}
