import { describe, expect, it } from 'vitest';
import { generateMap } from './mapGenerator.js';
import { getSpawnPosition } from './spawn.js';

describe('generateMap', () => {
    it('scales arena width with player count and gives Battle Royale extra room', () => {
        const small = generateMap(123, 2, 'classic');
        const crowded = generateMap(123, 8, 'classic');
        const battleRoyale = generateMap(123, 8, 'battleRoyale');

        expect(crowded.width).toBeGreaterThan(small.width);
        expect(battleRoyale.width).toBeGreaterThan(crowded.width);
        expect(battleRoyale.height).toBe(small.height);
    });

    it('generates fences, blocking rocks and lakes without covering player spawn zones', () => {
        const map = generateMap(98765, 16, 'battleRoyale');
        expect(map.obstacles.some(obstacle => obstacle.type === 'fence')).toBe(true);
        expect(map.obstacles.some(obstacle => obstacle.type === 'rock')).toBe(true);
        expect(map.obstacles.some(obstacle => obstacle.type === 'lake')).toBe(true);

        for (let index = 0; index < 32; index += 1) {
            const spawn = getSpawnPosition(index, map.width, map.height);
            for (const obstacle of map.obstacles) {
                const halfWidth = obstacle.width / 2 + 58;
                const halfHeight = obstacle.height / 2 + 58;
                const overlaps = Math.abs(spawn.x - obstacle.x) < halfWidth &&
                    Math.abs(spawn.y - obstacle.y) < halfHeight;
                expect(overlaps).toBe(false);
            }
        }
    });
});
