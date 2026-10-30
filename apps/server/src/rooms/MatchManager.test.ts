import { describe, expect, it, vi } from 'vitest';
import type { GameMode, PlayerState } from '@hackatec/shared';
import { MatchManager } from './MatchManager.js';

const player = (id: string, kills = 0, deaths = 0): PlayerState => ({
    id, name: id, x: 0, y: 0, kills, deaths, hp: 100, alive: true
});

describe('MatchManager', () => {

    it('publishes the server-authoritative alive-player roster', () => {
        const manager = new MatchManager();
        const eliminated = player('b');
        eliminated.alive = false;
        manager.syncRoom('room-a', [player('a'), eliminated], 'a', 0);
        expect(manager.getState('room-a')?.alivePlayerIds).toEqual(['a']);
    });

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

        expect(manager.vote('room-a', 'outsider', 'account-x', 'classic', 1).ok).toBe(false);
        expect(manager.vote('room-a', 'a', 'a', 'not-a-mode' as GameMode, 1).ok).toBe(false);
        expect(manager.vote('room-a', 'a', 'a', 'classic', 1).ok).toBe(true);
        expect(manager.vote('room-a', 'a', 'a', 'classic', 300).ok).toBe(true);
        expect(manager.getState('room-a')?.votes).toEqual({ a: 'classic' });
    });

    it('resolves the vote, resets into countdown, and then starts the match', () => {
        const manager = new MatchManager(100, 50, 1_000, 100);
        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);
        manager.vote('room-a', 'a', 'a', 'classic', 10);

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
        const manager = new MatchManager(100, 10, 50, 20, ['classic']);
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


    it('ends Classic early when a player reaches the configured kill limit', () => {
        const manager = new MatchManager(100, 10, 1_000, 15, ['classic']);
        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);
        manager.advance(100, () => []);
        manager.advance(110, () => []);
        manager.advance(111, () => [player('a', 30), player('b', 2)]);
        expect(manager.getState('room-a')).toMatchObject({
            phase: 'results',
            results: [{ playerId: 'a', kills: 30 }, { playerId: 'b', kills: 2 }]
        });
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
        manager.vote('room-a', 'a', 'a', 'classic', 1);
        expect(manager.getState('room-a')?.votes).toEqual({ a: 'classic' });
        expect(manager.getState('room-b')?.votes).toEqual({});
    });


    it('enforces one vote per account and a small vote rate limit', () => {
        const manager = new MatchManager();
        const players = [player('socket-a'), player('socket-b')];
        manager.syncRoom('room-a', players, 'socket-a', 0,
            new Map([['socket-a', 'account-a'], ['socket-b', 'account-a']]));
        expect(manager.vote('room-a', 'socket-a', 'account-a', 'classic', 1).ok).toBe(true);
        expect(manager.vote('room-a', 'socket-b', 'account-a', 'classic', 2).ok).toBe(false);
        expect(manager.vote('room-a', 'socket-a', 'account-a', 'classic', 100).ok).toBe(false);
        expect(manager.vote('room-a', 'socket-b', 'account-a', 'classic', 300).ok).toBe(true);
        expect(manager.getState('room-a')?.votes).toEqual({ 'socket-b': 'classic' });
    });

    it('makes players who join during a match spectators until the next round', () => {
        const manager = new MatchManager(100, 10, 100, 15, ['classic']);
        const players = [player('a'), player('b')];
        manager.syncRoom('room-a', players, 'a', 0);
        manager.advance(100, () => []);
        manager.advance(110, () => []);
        const late = player('late');
        manager.syncRoom('room-a', [...players, late], 'a', 120);
        expect(late.spectator).toBe(true);
        manager.advance(210, () => []);
        expect(manager.getState('room-a')?.phase).toBe('results');
    });

    it('chooses randomly among tied modes and when no one votes', () => {
        const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const tiedManager = new MatchManager(10, 5, 100, 15, ['classic', 'everyone-vs-one']);
        tiedManager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);
        tiedManager.vote('room-a', 'a', 'a', 'classic', 1);
        tiedManager.vote('room-a', 'b', 'b', 'everyone-vs-one', 1);
        tiedManager.advance(10, () => []);
        expect(tiedManager.getState('room-a')?.mode).toBe('everyone-vs-one');

        random.mockReturnValue(0);
        const emptyManager = new MatchManager(10, 5, 100, 15, ['classic', 'everyone-vs-one']);
        emptyManager.syncRoom('room-b', [player('c'), player('d')], 'c', 0);
        emptyManager.advance(10, () => []);
        expect(emptyManager.getState('room-b')?.mode).toBe('classic');
        random.mockRestore();
    });

    it('ends Todos contra uno when the Titan is eliminated and declares the hunters winner', () => {
        const manager = new MatchManager(10, 5, 1_000, 15);
        const titan = player('titan');
        titan.role = 'titan';
        const hunter = player('hunter');
        hunter.role = 'hunter';
        hunter.lives = 2;
        manager.syncRoom('room-titan', [titan, hunter], 'titan', 0);
        manager.vote('room-titan', 'titan', 'titan', 'everyone-vs-one', 1);
        manager.advance(10, () => [titan, hunter]);
        manager.advance(15, () => [titan, hunter]);

        titan.alive = false;
        titan.hp = 0;
        manager.advance(16, () => [titan, hunter]);

        expect(manager.getState('room-titan')).toMatchObject({
            phase: 'results',
            mode: 'everyone-vs-one',
            winnerId: 'hunter',
            winnerName: 'hunter'
        });
    });

    it('awards the Titan the win when all hunters run out of lives', () => {
        const manager = new MatchManager(10, 5, 1_000, 15);
        const titan = player('titan');
        titan.role = 'titan';
        const hunterA = player('hunter-a');
        hunterA.role = 'hunter';
        hunterA.lives = 0;
        hunterA.spectator = true;
        const hunterB = player('hunter-b');
        hunterB.role = 'hunter';
        hunterB.lives = 0;
        hunterB.spectator = true;
        manager.syncRoom('room-titan', [titan, hunterA, hunterB], 'titan', 0);
        manager.vote('room-titan', 'titan', 'titan', 'everyone-vs-one', 1);
        manager.advance(10, () => [titan, hunterA, hunterB]);
        manager.advance(15, () => [titan, hunterA, hunterB]);
        manager.advance(16, () => [titan, hunterA, hunterB]);

        expect(manager.getState('room-titan')).toMatchObject({
            phase: 'results',
            winnerId: 'titan'
        });
    });

    it('ends Battle Royale when one survivor remains and ranks them first', () => {
        const manager = new MatchManager(10, 5, 1_000, 15);
        const survivor = player('survivor');
        survivor.role = 'survivor';
        const eliminated = player('eliminated');
        eliminated.role = 'survivor';
        eliminated.alive = false;
        eliminated.spectator = true;
        manager.syncRoom('room-br', [survivor, eliminated], 'survivor', 0);
        manager.vote('room-br', 'survivor', 'survivor', 'battleRoyale', 1);
        manager.advance(10, () => [survivor, eliminated]);
        manager.advance(15, () => [survivor, eliminated]);
        manager.advance(16, () => [survivor, eliminated]);

        const result = manager.getState('room-br');
        expect(result).toMatchObject({
            phase: 'results',
            mode: 'battleRoyale',
            winnerId: 'survivor'
        });
        expect(result?.results[0]).toMatchObject({ playerId: 'survivor', placement: 1 });
    });

    it('gives Rocket para todos its own match duration', () => {
        const manager = new MatchManager(10, 5, 99_000, 15);
        const players = [player('a'), player('b')];
        manager.syncRoom('room-rockets', players, 'a', 0);
        manager.vote('room-rockets', 'a', 'a', 'rockets', 1);
        manager.advance(10, () => players);
        manager.advance(15, () => players);

        expect(manager.getState('room-rockets')).toMatchObject({
            phase: 'playing',
            mode: 'rockets',
            endsAt: 300_015
        });
    });

    it('removes lifecycle state when the room becomes empty', () => {
        const manager = new MatchManager();
        manager.syncRoom('room-a', [player('a'), player('b')], 'a', 0);
        manager.syncRoom('room-a', [], undefined, 1);
        expect(manager.getState('room-a')).toBeUndefined();
    });
});
