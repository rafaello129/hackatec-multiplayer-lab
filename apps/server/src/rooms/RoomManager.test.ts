import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS_PER_ROOM } from '../game/constants.js';
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

    it('assigns the first player as host and transfers host to the longest-waiting player', () => {
        const manager = new RoomManager();
        const first = manager.join('host-room', 'socket-a', 'Ana');
        manager.join('host-room', 'socket-b', 'Luis');
        manager.join('host-room', 'socket-c', 'Mia');
        expect(first.ok && first.hostId).toBe('socket-a');
        expect(manager.getHostId('host-room')).toBe('socket-a');
        const left = manager.leave('socket-a');
        expect(left?.hostId).toBe('socket-b');
        expect(manager.getHostId('host-room')).toBe('socket-b');
    });

    it('regenerates the map and resets all player round state', () => {
        const manager = new RoomManager();
        const joined = manager.join('round-room', 'socket-a', 'Ana');
        manager.join('round-room', 'socket-b', 'Luis');
        const players = manager.getPlayers('round-room');
        players[0]!.kills = 4;
        players[0]!.deaths = 2;
        players[0]!.hp = 10;
        players[0]!.assists = 3;
        players[0]!.zombieKills = 5;
        players[0]!.survivedStormPhases = 2;
        players[1]!.spectator = true;
        const oldSeed = manager.getMap('round-room')?.seed;
        const reset = manager.resetForMatch('round-room');
        expect(reset).toBeDefined();
        expect(reset?.map.seed).not.toBe(oldSeed);
        expect(reset?.players.every(player => player.kills === 0 && player.deaths === 0 &&
            player.assists === 0 && player.zombieKills === 0 && player.survivedStormPhases === 0 &&
            player.hp === 100 && player.spectator === false)).toBe(true);
        expect(manager.resetForMatch('missing-room')).toBeUndefined();
        expect(joined.ok).toBe(true);
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
    it('rejects overlong room IDs without altering current membership', () =>
    {
        const manager = new RoomManager();
        manager.join('valid', 'socket-a', 'Ana');
        expect(manager.join('a'.repeat(33), 'socket-a', 'Ana')).toMatchObject({
            ok: false,
            code: 'INVALID_ROOM'
        });
        expect(manager.getRoomId('socket-a')).toBe('valid');
    });

    it('does not evict a current player when target room is full', () =>
    {
        const manager = new RoomManager();
        manager.join('original', 'visitor', 'Ana');
        for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i += 1)
        {
            manager.join('target', 'member-' + i, 'Member');
        }
        const result = manager.join('target', 'visitor', 'Ana');
        expect(result).toMatchObject({ ok: false, code: 'ROOM_FULL' });
        expect(manager.getRoomId('visitor')).toBe('original');
    });

});