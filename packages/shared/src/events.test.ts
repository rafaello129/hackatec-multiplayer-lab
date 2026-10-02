import { describe, expect, it } from 'vitest';
import { SOCKET_EVENTS } from './events.js';

describe('shared socket contracts', () =>
{
    it('keeps the connection-ready event stable', () =>
    {
        expect(SOCKET_EVENTS.CONNECTION_READY).toBe('connection:ready');
    });

    it('defines the room presence protocol in one shared place', () =>
    {
        expect(SOCKET_EVENTS.ROOM_JOIN).toBe('room:join');
        expect(SOCKET_EVENTS.ROOM_STATE).toBe('room:state');
        expect(SOCKET_EVENTS.ROOM_ERROR).toBe('room:error');
        expect(SOCKET_EVENTS.PLAYER_JOINED).toBe('player:joined');
        expect(SOCKET_EVENTS.PLAYER_LEFT).toBe('player:left');
    });
});
