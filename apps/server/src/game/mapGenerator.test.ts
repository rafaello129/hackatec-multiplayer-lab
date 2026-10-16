import { describe, expect, it } from 'vitest';
import { generateMap, MAP_GENERATION_CONFIG as config } from './mapGenerator.js';
import { getSpawnPosition } from './spawn.js';
import { MAX_PLAYERS_PER_ROOM } from './constants.js';

describe('complete playable maps', () => {
    it('keeps cactus groups visible from the central crossing and its four approaches', () => {
        const map = generateMap(1);
        for (const [x,y] of [[1152,768],[850,600],[1450,600],[850,1050],[1450,1050]]) {
            const visible = map.obstacles.filter(o => o.type === 'cactus' &&
                Math.abs(o.x-x)+o.width/2 < 512 && Math.abs(o.y-y)+o.height/2 < 280);
            expect(visible.length, `camera at ${x}, ${y}`).toBeGreaterThanOrEqual(3);
        }
    });
    it('connects all 32 spawn pads to the central pass without touching walls or hazards', () => {
        for (let seed = 1; seed <= 6; seed++) {
            const map = generateMap(seed);
            const step = 16, columns = Math.floor((map.width-48)/step)+1, rows = Math.floor((map.height-48)/step)+1;
            const safe = (x: number, y: number) => map.obstacles.every(o =>
                Math.abs(x-o.x) >= o.width/2+21 || Math.abs(y-o.y) >= o.height/2+21);
            const seen = new Set<number>();
            const queue = [Math.round((map.height/2-24)/step)*columns+Math.round((map.width/2-24)/step)];
            seen.add(queue[0]);
            for (let head=0;head<queue.length;head++) {
                const id=queue[head], col=id%columns, row=Math.floor(id/columns);
                for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                    const c=col+dc,r=row+dr,next=r*columns+c;
                    if(c<0||c>=columns||r<0||r>=rows||seen.has(next)||!safe(24+c*step,24+r*step)) continue;
                    seen.add(next); queue.push(next);
                }
            }
            const spawns = Array.from({length:MAX_PLAYERS_PER_ROOM},(_,i)=>getSpawnPosition(i));
            for (const [i,spawn] of spawns.entries()) {
                const col=Math.round((spawn.x-24)/step),row=Math.round((spawn.y-24)/step);
                expect(seen.has(row*columns+col), `seed ${seed}, spawn ${i}`).toBe(true);
                for (const other of spawns.slice(i+1)) expect(Math.hypot(spawn.x-other.x,spawn.y-other.y)).toBeGreaterThan(42);
            }
        }
    });
    it('places all obstacles and preserves spawn safety and spacing across 100 seeds', () => {
        for (let seed = 1; seed <= 100; seed++) {
            const map = generateMap(seed);
            for (const type of ['wall', 'trap', 'cactus'] as const) {
                expect(map.obstacles.filter(o => o.type === type), `seed ${seed}: ${type}`).toHaveLength(config.counts[type]);
            }
            expect(new Set(map.obstacles.map(o => o.id)).size).toBe(map.obstacles.length);
            for (const [index, o] of map.obstacles.entries()) {
                expect(o.x - o.width / 2).toBeGreaterThanOrEqual(config.edgePadding);
                expect(o.x + o.width / 2).toBeLessThanOrEqual(map.width - config.edgePadding);
                expect(o.y - o.height / 2).toBeGreaterThanOrEqual(config.topBoundary);
                expect(o.y + o.height / 2).toBeLessThanOrEqual(config.bottomBoundary);
                for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
                    const spawn = getSpawnPosition(i);
                    expect(Math.abs(o.x - spawn.x) >= o.width / 2 + config.spawnClearance ||
                        Math.abs(o.y - spawn.y) >= o.height / 2 + config.spawnClearance, `${o.id} / spawn ${i}`).toBe(true);
                }
                for (const other of map.obstacles.slice(index + 1)) {
                    expect(Math.abs(o.x - other.x) >= (o.width + other.width) / 2 + config.obstacleGap ||
                        Math.abs(o.y - other.y) >= (o.height + other.height) / 2 + config.obstacleGap, `${o.id} / ${other.id}`).toBe(true);
                }
            }
        }
    });
    it('is deterministic including seeds outside the unsigned integer range', () => {
        for (const seed of [0, 1, -1, 0xffffffff]) expect(generateMap(seed)).toEqual(generateMap(seed));
        expect(generateMap(1)).not.toEqual(generateMap(2));
    });
});
