import { describe, expect, it } from 'vitest';
import type { GameMapState, PlayerState } from '@hackatec/shared';
import { ZOMBIE_BALANCE } from '@hackatec/shared';
import { isZombieMode, ZombieManager } from './ZombieManager.js';
import { getSpawnPosition } from '../game/spawn.js';

const map: GameMapState = { seed: 99, width: 1_024, height: 768, obstacles: [] };
const player = (id: string, x: number, y: number): PlayerState => ({
    id, name: id, x, y, hp: 100, maxHp: 100, alive: true
});

function blockedAt(x: number, y: number, sourceMap: GameMapState): boolean {
    return sourceMap.obstacles.some(obstacle => {
        const dx = Math.max(Math.abs(x - obstacle.x) - obstacle.width / 2, 0);
        const dy = Math.max(Math.abs(y - obstacle.y) - obstacle.height / 2, 0);
        return dx * dx + dy * dy < 32 * 32;
    });
}

describe('ZombieManager', () => {
    it('enables zombie AI only in the dedicated Zombies mode', () => {
        expect(isZombieMode('zombies')).toBe(true);
        for (const mode of ['classic', 'everyone-vs-one', 'rockets', 'battleRoyale', null]) {
            expect(isZombieMode(mode)).toBe(false);
        }
    });
    it('spawns a deterministic first wave outside obstacles and away from players', () => {
        const a = new ZombieManager();
        const b = new ZombieManager();
        const players = [player('a', 500, 420), player('b', 550, 420)];
        const stateA = a.reset('room', map, players, 0);
        const stateB = b.reset('room', map, players, 0);

        expect(stateA).toEqual(stateB);
        expect(stateA.zombies.length).toBeGreaterThanOrEqual(ZOMBIE_BALANCE.initialSpawnCount);
        expect(stateA.round).toBe(1);
        expect(stateA.runPhase).toBe('wave');
        for (const zombie of stateA.zombies) {
            expect(Math.hypot(zombie.x - 500, zombie.y - 420)).toBeGreaterThan(150);
        }
    });

    it('still places a wave in a room with 32 spread-out players', () => {
        const players = Array.from({ length: 32 }, (_, index) => {
            const spawn = getSpawnPosition(index);
            return player('p' + index, spawn.x, spawn.y);
        });
        const manager = new ZombieManager();
        const state = manager.reset('full-room', map, players, 0);

        expect(state.zombies.length).toBeGreaterThanOrEqual(ZOMBIE_BALANCE.initialSpawnCount);
        for (const zombie of state.zombies) {
            expect(players.every(item => Math.hypot(item.x - zombie.x, item.y - zombie.y) >= 75)).toBe(true);
            expect(blockedAt(zombie.x, zombie.y, map)).toBe(false);
        }
    });

    it('advances through ten rounds and exposes a scalable final boss', () => {
        const manager = new ZombieManager();
        const survivor = player('survivor', 500, 400);
        survivor.lives = ZOMBIE_BALANCE.initialLives;
        manager.reset('boss-run', map, [survivor], 0);
        let now = 0;

        for (let round = 1; round <= ZOMBIE_BALANCE.totalRounds; round += 1) {
            const wave = manager.getState('boss-run');
            expect(wave.round).toBe(round);
            expect(wave.runPhase).toBe('wave');
            manager.applyHits('boss-run', wave.zombies.map(zombie => ({
                zombieId: zombie.id,
                attackerId: survivor.id,
                damage: zombie.maxHp
            })), [survivor]);
            now += 50;
            manager.step('boss-run', [survivor], map, 50, now);
            expect(manager.getState('boss-run').runPhase).toBe('intermission');
            now += ZOMBIE_BALANCE.intermissionMs;
            manager.step('boss-run', [survivor], map, 50, now);
        }

        const bossState = manager.getState('boss-run');
        const boss = bossState.zombies.find(zombie => zombie.type === 'boss');
        expect(bossState.runPhase).toBe('boss');
        expect(boss?.maxHp).toBe(ZOMBIE_BALANCE.bossHealth);

        manager.applyHits('boss-run', [{
            zombieId: boss!.id,
            attackerId: survivor.id,
            damage: boss!.maxHp
        }], [survivor]);
        expect(manager.getState('boss-run').runPhase).toBe('won');
    });

    it('revives eliminated teammates at the next intermission with one life', () => {
        const manager = new ZombieManager();
        const survivor = player('survivor', 500, 400);
        survivor.lives = 2;
        const eliminated = player('eliminated', 800, 600);
        eliminated.lives = 0;
        eliminated.spectator = true;
        eliminated.alive = false;
        manager.reset('revive-run', map, [survivor, eliminated], 0);
        const wave = manager.getState('revive-run');
        manager.applyHits('revive-run', wave.zombies.map(zombie => ({
            zombieId: zombie.id,
            attackerId: survivor.id,
            damage: zombie.maxHp
        })), [survivor, eliminated]);
        manager.step('revive-run', [survivor, eliminated], map, 50, 50);
        const intermissionAt = 50 + ZOMBIE_BALANCE.intermissionMs;
        const step = manager.step('revive-run', [survivor, eliminated], map, 50, intermissionAt);

        expect(step?.revivedPlayerIds).toContain(eliminated.id);
        expect(eliminated).toMatchObject({ alive: true, spectator: false, lives: 1 });
    });


    it('requires an 800ms telegraph before a giant charges', () => {
        const manager = new ZombieManager();
        const target = player('target', 480, 400);
        const state = manager.reset('room', map, [target], 0);
        const giant = state.zombies.find(zombie => zombie.type === 'giant')!;
        const mutable = manager.getTargets('room').find(zombie => zombie.id === giant.id)!;
        mutable.x = target.x - 180;
        mutable.y = target.y;

        manager.step('room', [target], map, 50, 1_000);
        expect(mutable.phase).toBe('telegraph');
        const before = mutable.x;
        manager.step('room', [target], map, 50, 1_799);
        expect(mutable.phase).toBe('telegraph');
        expect(mutable.x).toBe(before);
        manager.step('room', [target], map, 50, 1_800);
        expect(mutable.phase).toBe('charge');
        expect(mutable.x).toBeGreaterThan(before);
    });

    it('stuns a giant for two seconds when its charge hits a wall', () => {
        const manager = new ZombieManager();
        const target = player('target', 1_000, 400);
        const state = manager.reset('room', map, [target], 0);
        const giant = manager.getTargets('room').find(zombie => zombie.type === 'giant')!;
        giant.x = 980;
        giant.y = 400;
        giant.phase = 'charge';
        giant.angle = 0;
        giant.phaseEndsAt = 1_000;

        manager.step('room', [target], map, 50, 1_000);
        expect(giant.phase).toBe('stunned');
        expect(giant.phaseEndsAt).toBe(1_000 + ZOMBIE_BALANCE.giant.stunnedMs);
    });

    it('damages zombies authoritatively and credits zombie kills to the attacker', () => {
        const manager = new ZombieManager();
        const attacker = player('attacker', 500, 400);
        const state = manager.reset('room', map, [attacker], 0);
        const giant = state.zombies.find(zombie => zombie.type === 'giant')!;
        const hit = manager.applyHits('room', [{ zombieId: giant.id, attackerId: attacker.id, damage: giant.maxHp }], [attacker]);

        expect(hit).toBe(true);
        expect(manager.getState('room').zombies.find(zombie => zombie.id === giant.id)?.alive).toBe(false);
        expect(attacker.zombieKills).toBe(1);
    });

    it('creates acid puddles and applies 6 damage per second for four seconds', () => {
        const manager = new ZombieManager();
        const target = player('target', 450, 420);
        manager.reset('room', map, [player('other', 800, 600)], 0);
        const spitter = manager.getTargets('room').find(zombie => zombie.type === 'spitter')!;
        spitter.x = 200;
        spitter.y = 420;
        manager.step('room', [target], map, 50, 1_000);
        expect(manager.getState('room').projectiles.length).toBe(1);

        const acidTicks: number[] = [];
        let firstPuddleId: string | undefined;
        for (let now = 1_050; now <= 6_050; now += 50) {
            const step = manager.step('room', [target], map, 50, now);
            for (const item of step?.damage ?? []) {
                if (item.amount <= 1) acidTicks.push(item.amount);
            }
            const firstPuddle = manager.getState('room').puddles[0];
            firstPuddleId ??= firstPuddle?.id;
        }
        expect(acidTicks.length).toBeGreaterThan(50);
        expect(acidTicks[0]).toBeCloseTo(0.3);
        expect(firstPuddleId).toBeDefined();
        expect(manager.getState('room').puddles.some(puddle => puddle.id === firstPuddleId)).toBe(false);
    });

    it('does not allow zombies to target or damage spectators', () => {
        const manager = new ZombieManager();
        const spectator = player('spectator', 500, 400);
        spectator.spectator = true;
        manager.reset('room', map, [player('active', 700, 600)], 0);
        const state = manager.getTargets('room')[0]!;
        state.x = spectator.x - 50;
        state.y = spectator.y;
        manager.step('room', [spectator], map, 50, 1_000);
        expect(state.targetId).toBeNull();
    });
});
