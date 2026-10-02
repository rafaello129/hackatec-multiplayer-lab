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
});
