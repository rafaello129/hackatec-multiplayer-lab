import type { GameMapState, PlayerInput, PlayerState } from '@hackatec/shared';
import { ARENA_WIDTH } from './constants.js';

const PLAYER_RADIUS = 21;
const SPEED = 185;
const DASH_MULTIPLIER = 1.8;
const DASH_MS = 250;
const DASH_COOLDOWN_MS = 4000;
const INPUT_TIMEOUT_MS = 250;
const MAX_STEP_SECONDS = 0.05;

export type MovementRuntime = {
    input: PlayerInput;
    lastInputAt: number;
    dashUntil: number;
    nextDashAt: number;
};

export function createMovementRuntime(): MovementRuntime {
    return {
        input: { up: false, down: false, left: false, right: false, dash: false },
        lastInputAt: 0,
        dashUntil: 0,
        nextDashAt: 0
    };
}

export function acceptMovementInput(state: MovementRuntime, input: PlayerInput, now: number, player?: PlayerState): void {
    const dashPressed = input.dash && !state.input.dash;
    state.input = { ...input };
    state.lastInputAt = now;
    if (dashPressed && now >= state.nextDashAt && player?.alive !== false && (player?.immobilizedUntil ?? 0) <= now) {
        state.dashUntil = now + DASH_MS;
        state.nextDashAt = now + DASH_COOLDOWN_MS;
    }
}

function blocked(x: number, y: number, map: GameMapState): boolean {
    if (x < PLAYER_RADIUS || x > ARENA_WIDTH - PLAYER_RADIUS ||
        y < 155 + PLAYER_RADIUS || y > 715 - PLAYER_RADIUS) return true;

    return map.obstacles.some(obstacle => {
        if (obstacle.type !== 'wall') return false;
        const dx = Math.max(Math.abs(x - obstacle.x) - obstacle.width / 2, 0);
        const dy = Math.max(Math.abs(y - obstacle.y) - obstacle.height / 2, 0);
        return dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS;
    });
}

export function advanceMovement(player: PlayerState, state: MovementRuntime, map: GameMapState, deltaMs: number, now: number): boolean {
    if (player.alive === false || player.spectator) { player.isDashing = false; return false; }
    const input = now - state.lastInputAt <= INPUT_TIMEOUT_MS ? state.input : undefined;
    player.isDashing = now < state.dashUntil && (player.immobilizedUntil ?? 0) <= now;
    if ((player.immobilizedUntil ?? 0) > now) return false;
    if (!input) return false;
    let x = Number(input.right) - Number(input.left);
    let y = Number(input.down) - Number(input.up);
    if (x === 0 && y === 0) return false;
    const length = Math.hypot(x, y);
    x /= length;
    y /= length;
    const distance = SPEED * (player.isDashing ? DASH_MULTIPLIER : 1) * Math.max(0, Math.min(deltaMs / 1000, MAX_STEP_SECONDS));
    const nextX = player.x + x * distance;
    const nextY = player.y + y * distance;
    const oldX = player.x, oldY = player.y;
    // Resolve per-axis to permit sliding along walls.
    if (!blocked(nextX, player.y, map)) player.x = nextX;
    if (!blocked(player.x, nextY, map)) player.y = nextY;
    return player.x !== oldX || player.y !== oldY;
}
