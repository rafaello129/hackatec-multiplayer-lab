import { describe, expect, it } from 'vitest';
import type { PlayerState } from '@hackatec/shared';
import { MatchManager } from './MatchManager.js';

const player = (id: string, kills = 0, deaths = 0): PlayerState => ({
    id, name: id, x: 0, y: 0, kills, deaths, hp: 100, alive: true
});

describe('MatchManager', () => {
    it('opens voting automatically when the second player joins', () => {
        const manager = new MatchManager();
        manager.syncRoom('room-a', [player('a')], 'a', 100);
        expect(manager.getState('room-a')?.phase).toBe('waiting');

        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 200);
        expect(manager.getState('room-a')).toMatchObject({
            phase: 'voting',
            hostId: 'a',
            voteEndsAt: 15_200
        });
    });

    it('allows only room members to vote and lets a member change their vote', () => {
        const manager = new MatchManager();
        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);

        expect(manager.vote('room-a', 'outsider', 'classic', 1).ok).toBe(false);
        expect(manager.vote('room-a', 'a', 'team', 1).ok).toBe(false);
        expect(manager.vote('room-a', 'a', 'classic', 1).ok).toBe(true);
        expect(manager.vote('room-a', 'a', 'classic', 2).ok).toBe(true);
        expect(manager.getState('room-a')?.votes).toEqual({ a: 'classic' });
    });

    it('resolves the vote, resets into countdown, and then starts the match', () => {
        const manager = new MatchManager(100, 50, 1_000, 100);
        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);
        manager.vote('room-a', 'a', 'classic', 10);

        const transitions = manager.advance(100, () => []);
        expect(transitions).toEqual([{ roomId: 'room-a', resetPlayers: true }]);
        expect(manager.getState('room-a')?.phase).toBe('countdown');
        expect(manager.isPlaying('room-a')).toBe(false);

        manager.advance(150, () => []);
        expect(manager.getState('room-a')).toMatchObject({
            phase: 'playing',
            mode: 'classic',
            endsAt: 1_150
        });
        expect(manager.isPlaying('room-a')).toBe(true);
    });

    it('captures results and automatically opens the next vote', () => {
        const manager = new MatchManager(100, 10, 50, 20);
        manager.syncRoom('room-a', [player('a', 3, 1), player('b', 2, 0)], 'a', 0);
        manager.advance(100, () => []);
        manager.advance(110, () => []);
        manager.advance(160, () => [player('a', 3, 1), player('b', 2, 0)]);

        expect(manager.getState('room-a')).toMatchObject({
            phase: 'results',
            results: [
                { playerId: 'a', kills: 3, deaths: 1 },
                { playerId: 'b', kills: 2, deaths: 0 }
            ]
        });

        manager.advance(180, () => []);
        expect(manager.getState('room-a')?.phase).toBe('voting');
    });

    it('allows only the host to force a new match or stop one', () => {
        const manager = new MatchManager(100, 20, 1_000, 100);
        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);

        expect(manager.forceStart('room-a', 'b', 'classic', 1).ok).toBe(false);
        expect(manager.forceStart('room-a', 'a', 'classic', 2).ok).toBe(true);
        expect(manager.getState('room-a')?.phase).toBe('countdown');

        expect(manager.stop('room-a', 'b').ok).toBe(false);
        expect(manager.stop('room-a', 'a').ok).toBe(true);
        expect(manager.getState('room-a')?.phase).toBe('waiting');

        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 3);
        expect(manager.getState('room-a')?.phase).toBe('waiting');
    });

    it('cancels a vote if the room falls below two players', () => {
        const manager = new MatchManager();
        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);
        manager.syncRoom('room-a', [player('b')], 'b', 1);
        expect(manager.getState('room-a')).toMatchObject({
            phase: 'waiting',
            hostId: 'b',
            voteEndsAt: null
        });
    });

    it('isolates lifecycle and votes between rooms', () => {
        const manager = new MatchManager();
        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);
        manager.syncRoom('room-b', [player('c'), player('d')], 'c', 0);
        manager.vote('room-a', 'a', 'classic', 1);
        expect(manager.getState('room-a')?.votes).toEqual({ a: 'classic' });
        expect(manager.getState('room-b')?.votes).toEqual({});
    });

    it('removes lifecycle state when the room becomes empty', () => {
        const manager = new MatchManager();
        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);
        manager.syncRoom('room-a', [], undefined, 1);
        expect(manager.getState('room-a')).toBeUndefined();
    });
});
