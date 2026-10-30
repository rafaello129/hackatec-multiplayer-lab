import { describe, expect, it } from 'vitest';
import type { PlayerState } from '@hackatec/shared';
import { calculateMatchAwards, RoundActivityTracker, ACTIVITY_BALANCE } from './ProgressionManager.js';

const player = (id: string, stats: Partial<PlayerState> = {}): PlayerState => ({
    id, name: id, x: 0, y: 0, alive: true, ...stats
});

describe('calculateMatchAwards', () => {
    it('awards kill, assist, zombie, winner and top-three XP from server state', () => {
        const players = [
            player('winner', { kills: 2, assists: 1, zombieKills: 3, survivedStormPhases: 4 }),
            player('second', { kills: 1, assists: 2, zombieKills: 0 }),
            player('fourth', { kills: 0 })
        ];
        const awards = calculateMatchAwards(players, [
            { playerId: 'winner', placement: 1 },
            { playerId: 'second', placement: 2 },
            { playerId: 'fourth', placement: 4 }
        ], 'battleRoyale', 'winner');

        expect(awards).toEqual([
            {
                playerId: 'winner',
                xp: 100 + 20 + 30 + 100 + 150,
                breakdown: { kills: 100, assists: 20, zombieKills: 30, survival: 100, placement: 150 }
            },
            {
                playerId: 'second',
                xp: 50 + 40 + 0 + 0 + 75,
                breakdown: { kills: 50, assists: 40, zombieKills: 0, survival: 0, placement: 75 }
            },
            {
                playerId: 'fourth',
                xp: 0,
                breakdown: { kills: 0, assists: 0, zombieKills: 0, survival: 0, placement: 0 }
            }
        ]);
    });

    it('does not award Battle Royale survival XP in other modes', () => {
        const awards = calculateMatchAwards(
            [player('p', { survivedStormPhases: 5 })],
            [{ playerId: 'p', placement: 1 }],
            'classic',
            null
        );
        expect(awards[0]?.xp).toBe(0);
    });
});

describe('RoundActivityTracker', () => {
    it('does not count an idle player and requires meaningful input over time', () => {
        const tracker = new RoundActivityTracker();
        tracker.start('room', [player('idle'), player('active')], 0, 300_000);

        for (let now = 50; now <= 60_000; now += 50) tracker.tick('room', now);
        expect(tracker.getActiveMs('room', 'idle')).toBe(0);
        expect(tracker.isEligible('room', 'idle')).toBe(false);

        tracker.mark('room', 'active', 60_000);
        for (let now = 60_050; now <= 90_000; now += 50) {
            tracker.mark('room', 'active', now);
            tracker.tick('room', now);
        }
        expect(tracker.getActiveMs('room', 'active')).toBeGreaterThanOrEqual(ACTIVITY_BALANCE.minimumActiveMs);
        expect(tracker.isEligible('room', 'active')).toBe(true);
    });

    it('clears round activity when the room is removed', () => {
        const tracker = new RoundActivityTracker();
        tracker.start('room', [player('p')], 0, 1_000);
        tracker.mark('room', 'p', 10);
        tracker.removeRoom('room');
        expect(tracker.getActiveMs('room', 'p')).toBe(0);
    });
});
