import { describe, expect, it } from 'vitest';
import { ARENA_HEIGHT, ARENA_WIDTH } from './constants.js';
import { getSpawnPosition } from './spawn.js';

describe('spawn positions', () =>
{
    it('keeps generated positions inside the arena', () =>
    {
        for (let index = 0; index < 32; index += 1)
        {
            const spawn = getSpawnPosition(index);

            expect(spawn.x).toBeGreaterThan(0);
            expect(spawn.x).toBeLessThan(ARENA_WIDTH);
            expect(spawn.y).toBeGreaterThan(0);
            expect(spawn.y).toBeLessThan(ARENA_HEIGHT);
        }
    });

    it('is deterministic and gives early players different positions', () =>
    {
        expect(getSpawnPosition(2)).toEqual(getSpawnPosition(2));
        expect(getSpawnPosition(0)).not.toEqual(getSpawnPosition(1));
    });

    it('spreads the first four players across distant parts of the arena', () =>
    {
        const positions = Array.from({ length: 4 }, (_, index) => getSpawnPosition(index));
        for (let first = 0; first < positions.length; first += 1)
        {
            for (let second = first + 1; second < positions.length; second += 1)
            {
                const distance = Math.hypot(
                    positions[first]!.x - positions[second]!.x,
                    positions[first]!.y - positions[second]!.y
                );
                expect(distance).toBeGreaterThan(500);
            }
        }
    });
});
