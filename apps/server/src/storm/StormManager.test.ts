import { describe, expect, it } from 'vitest';
import type { GameMapState, PlayerState } from '@hackatec/shared';
import { STORM_BALANCE } from '@hackatec/shared';
import { StormManager } from './StormManager.js';

const map: GameMapState = { seed: 12345, width: 1_024, height: 768, obstacles: [] };
const player = (id: string, x: number, y: number): PlayerState => ({
    id, name: id, x, y, hp: 100, maxHp: 100, alive: true
});

describe('StormManager', () => {
    it('creates deterministic initial state and starts closing after the 30s wait', () => {
        const a = new StormManager();
        const b = new StormManager();
        const first = a.start('a', map, 10_000);
        const second = b.start('a', map, 10_000);

        expect(first).toEqual(second);
        expect(first.phase).toBe(1);
        expect(first.closing).toBe(false);
        expect(a.getState('a', 10_000 + STORM_BALANCE.waitMs)?.closing).toBe(true);
    });

    it('closes over 45 seconds and only shrinks the safe zone', () => {
        const manager = new StormManager();
        const initial = manager.start('room', map, 0);
        const half = manager.getState('room', STORM_BALANCE.waitMs + STORM_BALANCE.closeMs / 2)!;
        const end = manager.getState('room', STORM_BALANCE.waitMs + STORM_BALANCE.closeMs)!;

        expect(half.radius).toBeLessThan(initial.radius);
        expect(half.radius).toBeGreaterThan(end.radius);
        expect(end.radius).toBe(220);
    });

    it('applies authoritative damage only to active players outside the current circle', () => {
        const manager = new StormManager();
        manager.start('room', map, 0);
        const center = manager.getState('room', 0)!;
        const outside = player('outside', center.centerX + center.radius + 10, center.centerY);
        const inside = player('inside', center.centerX, center.centerY);
        const spectator = player('spectator', center.centerX + center.radius + 30, center.centerY);
        spectator.spectator = true;

        const step = manager.step('room', [outside, inside, spectator], map, 50, 1_000)!;
        expect(step.damage).toEqual([{ playerId: 'outside', amount: 0.1 }]);
    });

    it('advances through five phases and ends at the minimum radius', () => {
        const manager = new StormManager();
        manager.start('room', map, 0);
        const phaseDuration = STORM_BALANCE.waitMs + STORM_BALANCE.closeMs;
        const beforeLastEnd = manager.getState('room', phaseDuration * 4 + STORM_BALANCE.waitMs + STORM_BALANCE.closeMs - 1)!;
        const completed = manager.getState('room', phaseDuration * 5)!;
        expect(beforeLastEnd.phase).toBe(5);
        expect(completed.phase).toBe(5);
        expect(completed.completed).toBe(true);
        expect(completed.radius).toBe(STORM_BALANCE.minimumRadius);
    });

    it('cleans room state when the last player leaves', () => {
        const manager = new StormManager();
        manager.start('room', map, 0);
        manager.removeRoom('room');
        expect(manager.getState('room', 0)).toBeUndefined();
    });
});
