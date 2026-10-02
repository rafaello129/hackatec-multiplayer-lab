import { describe, expect, it } from 'vitest';
import {
    isValidRoomId,
    normalizePlayerName,
    RoomManager
} from './RoomManager.js';

describe('RoomManager', () =>
{
    it('adds multiple players to the same room', () =>
    {
        const manager = new RoomManager();

        const first = manager.join('hackatec', 'socket-a', 'Ana');
        const second = manager.join('hackatec', 'socket-b', 'Luis');

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        expect(manager.getPlayers('hackatec')).toHaveLength(2);
    });

    it('removes a player and deletes an empty room', () =>
    {
        const manager = new RoomManager();

        manager.join('hackatec', 'socket-a', 'Ana');
        expect(manager.hasRoom('hackatec')).toBe(true);

        manager.leave('socket-a');

        expect(manager.getPlayers('hackatec')).toEqual([]);
        expect(manager.hasRoom('hackatec')).toBe(false);
    });

    it('isolates different rooms', () =>
    {
        const manager = new RoomManager();

        manager.join('hackatec', 'socket-a', 'Ana');
        manager.join('otra', 'socket-b', 'Luis');

        expect(manager.getPlayers('hackatec').map((player) => player.name)).toEqual(['Ana']);
        expect(manager.getPlayers('otra').map((player) => player.name)).toEqual(['Luis']);
    });

    it('moves a socket from its previous room', () =>
    {
        const manager = new RoomManager();

        manager.join('room-a', 'socket-a', 'Ana');
        const result = manager.join('room-b', 'socket-a', 'Ana');

        expect(result.ok).toBe(true);
        expect(manager.getPlayers('room-a')).toEqual([]);
        expect(manager.getPlayers('room-b')).toHaveLength(1);
        expect(manager.getRoomId('socket-a')).toBe('room-b');

        if (result.ok)
        {
            expect(result.previous?.roomId).toBe('room-a');
        }
    });

    it('rejects invalid room identifiers', () =>
    {
        const manager = new RoomManager();

        expect(manager.join('../admin', 'socket-a', 'Ana')).toMatchObject({
            ok: false,
            code: 'INVALID_ROOM'
        });
        expect(isValidRoomId('equipo-1')).toBe(true);
        expect(isValidRoomId('mesa_04')).toBe(true);
    });

    it('normalizes names and creates a fallback name', () =>
    {
        expect(normalizePlayerName('  Ana   María  ', 'abcd1234')).toBe('Ana María');
        expect(normalizePlayerName('', 'abcd1234')).toBe('Player-ABCD');
    });

    it('reuses a free spawn instead of overlapping players', () =>
    {
        const manager = new RoomManager();

        const first = manager.join('hackatec', 'socket-a', 'A');
        const second = manager.join('hackatec', 'socket-b', 'B');

        manager.leave('socket-a');

        const third = manager.join('hackatec', 'socket-c', 'C');

        if (first.ok && second.ok && third.ok)
        {
            expect(third.player.x).toBe(first.player.x);
            expect(third.player.y).toBe(first.player.y);
            expect(third.player.x).not.toBe(second.player.x);
        }
    });
});
