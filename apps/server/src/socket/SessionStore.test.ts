import { describe, expect, it } from 'vitest';
import { SessionStore } from './SessionStore.js';

describe('reconnection credentials', () => {
    it('recovers only a disconnected, unexpired server-issued session', () => {
        const store = new SessionStore(30000);
        const first = store.open(undefined, 'socket-a', 0).session;
        expect(first.token).toMatch(/^[a-f0-9]{64}$/);
        store.suspend(first.playerId, 'socket-a', 100);
        const resumed = store.open(first.token, 'socket-b', 200);
        expect(resumed.recovered).toBe(true);
        expect(resumed.session.playerId).toBe('socket-a');
        expect(store.expired(30100)).toEqual([]);
        expect(store.suspend(first.playerId, 'socket-a', 300)).toBe(false);
    });
    it('does not let an active token, a player ID or a fabricated token take over', () => {
        const store = new SessionStore();
        const first = store.open(undefined, 'a', 0).session;
        for (const token of [first.token, first.playerId, 'fake']) {
            expect(store.open(token, 'other-' + token, 1).recovered).toBe(false);
        }
        expect(first.socketId).toBe('a');
    });
    it('expires at the deadline and invalidates credentials on permanent leave', () => {
        const store = new SessionStore(100);
        const first = store.open(undefined, 'a', 0).session;
        store.suspend('a', 'a', 10);
        expect(store.expired(109)).toEqual([]);
        expect(store.expired(110)).toEqual(['a']);
        expect(store.open(first.token, 'b', 110).recovered).toBe(false);
        store.remove('a');
        expect(store.expired(200)).toEqual([]);
        expect(store.open(first.token, 'c', 20).recovered).toBe(false);
    });
});
