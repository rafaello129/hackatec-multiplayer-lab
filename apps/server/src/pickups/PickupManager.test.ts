import { describe, expect, it } from 'vitest';
import type { GameMapState, PlayerState } from '@hackatec/shared';
import { PICKUP_BALANCE } from '@hackatec/shared';
import { PickupManager } from './PickupManager.js';

const map: GameMapState = { seed: 75, width: 1_024, height: 768, obstacles: [] };
const player = (id: string, x: number, y: number, hp = 100, shield = 0): PlayerState => ({
    id, name: id, x, y, hp, maxHp: 100, shield, alive: true
});

describe('PickupManager', () => {
    it('generates deterministic pickups outside all map obstacles', () => {
        const first = new PickupManager();
        const second = new PickupManager();
        const a = first.reset('room', map);
        const b = second.reset('room', map);
        expect(a).toEqual(b);
        expect(a.length).toBe(6);
        expect(a.filter(pickup => pickup.type === 'medkit')).toHaveLength(2);
        expect(a.filter(pickup => pickup.type === 'shield')).toHaveLength(4);
        for (const pickup of a) {
            expect(map.obstacles.some(obstacle => {
                const dx = Math.max(Math.abs(pickup.x - obstacle.x) - obstacle.width / 2, 0);
                const dy = Math.max(Math.abs(pickup.y - obstacle.y) - obstacle.height / 2, 0);
                return dx * dx + dy * dy < 23 * 23;
            })).toBe(false);
        }
    });

    it('heals without exceeding max health and does not consume a full-health medkit', () => {
        const manager = new PickupManager();
        const pickups = manager.reset('room', map);
        const medkit = pickups.find(pickup => pickup.type === 'medkit')!;
        const full = player('full', medkit.x, medkit.y);
        const ignored = manager.step('room', [full], 'classic', 1_000);
        expect(ignored.collected).toHaveLength(0);
        expect(manager.getState('room').find(item => item.id === medkit.id)?.active).toBe(true);

        const injured = player('injured', medkit.x, medkit.y, 70);
        const collected = manager.step('room', [injured], 'classic', 1_050);
        expect(injured.hp).toBe(100);
        expect(collected.collected[0]?.restored).toBe(30);
        expect(collected.pickups.find(item => item.id === medkit.id)?.active).toBe(false);
        expect(collected.pickups.find(item => item.id === medkit.id)?.respawnAt)
            .toBe(1_050 + PICKUP_BALANCE.medkitRespawnMs);
    });

    it('collects a pickup only once when two players touch it on the same tick', () => {
        const manager = new PickupManager();
        const pickups = manager.reset('room', map);
        const medkit = pickups.find(pickup => pickup.type === 'medkit')!;
        const a = player('a', medkit.x, medkit.y, 50);
        const b = player('b', medkit.x + 1, medkit.y, 50);
        const result = manager.step('room', [a, b], 'classic', 2_000);

        expect(result.collected).toHaveLength(1);
        expect([a.hp, b.hp].filter(hp => hp === 90)).toHaveLength(1);
        expect(manager.getState('room').find(item => item.id === medkit.id)?.respawnAt)
            .toBe(2_000 + PICKUP_BALANCE.respawnMs);
    });

    it('adds shield up to the cap and uses the slower Battle Royale respawn', () => {
        const manager = new PickupManager();
        const pickups = manager.reset('room', map);
        const shieldPickup = pickups.find(pickup => pickup.type === 'shield')!;
        const playerWithSpace = player('shielded', shieldPickup.x, shieldPickup.y, 100, 35);
        const result = manager.step('room', [playerWithSpace], 'battleRoyale', 3_000);

        expect(playerWithSpace.shield).toBe(50);
        expect(result.collected[0]?.restored).toBe(15);
        expect(result.pickups.find(item => item.id === shieldPickup.id)?.respawnAt)
            .toBe(3_000 + PICKUP_BALANCE.battleRoyaleRespawnMs);

        const medkit = pickups.find(pickup => pickup.type === 'medkit')!;
        const injured = player('injured', medkit.x, medkit.y, 50);
        const medkitResult = manager.step('room', [injured], 'battleRoyale', 4_000);
        expect(medkitResult.pickups.find(item => item.id === medkit.id)?.respawnAt)
            .toBe(4_000 + PICKUP_BALANCE.battleRoyaleMedkitRespawnMs);
    });

    it('removes state cleanly when the room is empty', () => {
        const manager = new PickupManager();
        manager.reset('room', map);
        manager.removeRoom('room');
        expect(manager.getState('room')).toEqual([]);
    });
});
