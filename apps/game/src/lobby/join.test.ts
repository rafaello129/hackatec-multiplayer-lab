import { EventEmitter } from 'node:events';
import type { Socket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS } from '@hackatec/shared';
import { joinFromLobby } from './join';

class TestSocket extends EventEmitter {
    connected = false;
    connect() { this.connected = true; this.emit('connect'); }
    disconnect() { this.connected = false; this.emit('disconnect'); }
}
describe('lobby join lifecycle', () => {
    afterEach(() => vi.useRealTimers());
    it('joins once and removes lobby listeners after the matching snapshot', async () => {
        const socket = new TestSocket();
        const emit = vi.spyOn(socket, 'emit');
        const pending = joinFromLobby(socket as unknown as Socket, { roomId: 'test', playerName: 'Ana' });
        const state = { roomId: 'test', selfId: 'a', players: [], map: { seed: 1, width: 1024, height: 768, obstacles: [] } };
        socket.emit(SOCKET_EVENTS.ROOM_STATE, state);
        expect(await pending).toEqual(state);
        expect(emit.mock.calls.filter(([event]) => event === SOCKET_EVENTS.ROOM_JOIN)).toHaveLength(1);
        expect(socket.eventNames()).toHaveLength(0);
        expect(socket.connected).toBe(true);
    });
    it('preserves room-full feedback and disconnects failed attempts', async () => {
        const socket = new TestSocket();
        const pending = joinFromLobby(socket as unknown as Socket, { roomId: 'full' });
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { code: 'ROOM_FULL', message: 'La sala está llena.' });
        await expect(pending).rejects.toThrow('La sala está llena.');
        expect(socket.eventNames()).toHaveLength(0);
        expect(socket.connected).toBe(false);
    });
    it('bounds waiting and leaves no listeners after a timeout', async () => {
        vi.useFakeTimers();
        const socket = new TestSocket();
        const pending = joinFromLobby(socket as unknown as Socket, { roomId: 'silent' });
        const assertion = expect(pending).rejects.toThrow('tardó demasiado');
        await vi.advanceTimersByTimeAsync(12000);
        await assertion;
        expect(socket.eventNames()).toHaveLength(0);
        expect(socket.connected).toBe(false);
    });
});
