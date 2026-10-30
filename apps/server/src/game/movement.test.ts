import { describe, expect, it } from 'vitest';
import type { GameMapState, PlayerInput, PlayerState } from '@hackatec/shared';
import { DASH_BALANCE } from '@hackatec/shared';
import { acceptMovementInput, advanceMovement, createMovementRuntime } from './movement.js';

const openMap: GameMapState = { seed: 1, width: 1_024, height: 768, obstacles: [] };
const input = (overrides: Partial<PlayerInput> = {}): PlayerInput => ({
    up: false, down: false, left: false, right: false, dash: false, aimAngle: 0, ...overrides
});
const createPlayer = (): PlayerState => ({
    id: 'p1', name: 'Player', x: 300, y: 400, hp: 100, maxHp: 100, alive: true
});

describe('authoritative dash', () => {
    it('travels about 170px in 160ms when the player is stationary, using aim angle', () => {
        const player = createPlayer();
        const runtime = createMovementRuntime();
        acceptMovementInput(runtime, input({ dash: true, aimAngle: 0 }), 1_000, player);

        advanceMovement(player, runtime, openMap, 50, 1_050);
        advanceMovement(player, runtime, openMap, 50, 1_100);
        advanceMovement(player, runtime, openMap, 50, 1_150);
        advanceMovement(player, runtime, openMap, 10, 1_160);

        expect(player.x - 300).toBeCloseTo(DASH_BALANCE.distancePx, 4);
        expect(player.y).toBe(400);
        expect(player.isDashing).toBe(false);
        expect(player.isInvulnerable).toBe(true);
    });

    it('keeps the short 300ms invulnerability window and enforces the 2.5s cooldown', () => {
        const player = createPlayer();
        const runtime = createMovementRuntime();
        acceptMovementInput(runtime, input({ dash: true, aimAngle: 0 }), 1_000, player);

        expect(player.isInvulnerable).toBe(true);
        expect(player.dashReadyAt).toBe(1_000 + DASH_BALANCE.cooldownMs);

        advanceMovement(player, runtime, openMap, 50, 1_300);
        expect(player.isInvulnerable).toBe(false);

        acceptMovementInput(runtime, input({ dash: false }), 1_400, player);
        acceptMovementInput(runtime, input({ dash: true, aimAngle: 0 }), 1_500, player);
        expect(player.dashReadyAt).toBe(1_000 + DASH_BALANCE.cooldownMs);
    });

    it('stops at a wall instead of dashing through it', () => {
        const player = createPlayer();
        const runtime = createMovementRuntime();
        const map: GameMapState = {
            ...openMap,
            obstacles: [{ id: 'wall', type: 'wall', x: 350, y: 400, width: 20, height: 200 }]
        };
        acceptMovementInput(runtime, input({ dash: true, aimAngle: 0 }), 1_000, player);
        advanceMovement(player, runtime, map, 50, 1_050);
        advanceMovement(player, runtime, map, 50, 1_100);

        expect(player.x).toBeLessThan(350 - 10 - 21);
        expect(player.isDashing).toBe(false);
    });

    it('blocks movement through rocks and lakes but slows players on fences', () => {
        for (const type of ['rock', 'lake'] as const) {
            const player = createPlayer();
            const runtime = createMovementRuntime();
            const map: GameMapState = {
                ...openMap,
                obstacles: [{ id: type, type, x: 310, y: 400, width: 60, height: 60 }]
            };
            acceptMovementInput(runtime, input({ right: true }), 1_000, player);
            advanceMovement(player, runtime, map, 50, 1_050);
            expect(player.x).toBe(300);
        }

        const player = createPlayer();
        const runtime = createMovementRuntime();
        const fenceMap: GameMapState = {
            ...openMap,
            obstacles: [{ id: 'fence', type: 'fence', x: 300, y: 400, width: 100, height: 30 }]
        };
        acceptMovementInput(runtime, input({ right: true }), 1_000, player);
        advanceMovement(player, runtime, fenceMap, 50, 1_050);
        expect(player.x - 300).toBeLessThan(185 * 0.05);
        expect(player.x).toBeGreaterThan(300);
    });

    it('does not start while trapped and uses movement direction when available', () => {
        const trapped = createPlayer();
        trapped.immobilizedUntil = 2_000;
        const trappedRuntime = createMovementRuntime();
        acceptMovementInput(trappedRuntime, input({ dash: true, right: true }), 1_000, trapped);
        expect(trapped.dashReadyAt).toBeUndefined();

        const moving = createPlayer();
        const runtime = createMovementRuntime();
        acceptMovementInput(runtime, input({ dash: true, down: true, aimAngle: Math.PI }), 1_000, moving);
        advanceMovement(moving, runtime, openMap, 50, 1_050);
        expect(moving.y).toBeGreaterThan(400);
        expect(moving.x).toBeCloseTo(300);
    });
});
