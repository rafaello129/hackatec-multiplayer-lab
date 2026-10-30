import {
    COMBAT_BALANCE,
    DASH_BALANCE,
    MOVEMENT_BALANCE,
    type GameMapState,
    type PlayerInput,
    type PlayerState
} from '@hackatec/shared';

const PLAYER_RADIUS = COMBAT_BALANCE.playerRadius;
const SPEED = MOVEMENT_BALANCE.speedPxPerSecond;
const INPUT_TIMEOUT_MS = MOVEMENT_BALANCE.inputTimeoutMs;
const MAX_STEP_SECONDS = COMBAT_BALANCE.serverTickMs / 1_000;

export type MovementRuntime = {
    input: PlayerInput;
    lastInputAt: number;
    aimAngle: number;
    dashStartedAt: number | null;
    dashAppliedProgress: number;
    dashDirectionX: number;
    dashDirectionY: number;
    dashInvulnerableUntil: number;
    nextDashAt: number;
};

export function createMovementRuntime(): MovementRuntime {
    return {
        input: { up: false, down: false, left: false, right: false, dash: false },
        lastInputAt: 0,
        aimAngle: 0,
        dashStartedAt: null,
        dashAppliedProgress: 0,
        dashDirectionX: 1,
        dashDirectionY: 0,
        dashInvulnerableUntil: 0,
        nextDashAt: 0
    };
}

function normalize(x: number, y: number): { x: number; y: number } {
    const length = Math.hypot(x, y);
    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function blocked(x: number, y: number, map: GameMapState): boolean {
    if (x < PLAYER_RADIUS || x > map.width - PLAYER_RADIUS ||
        y < COMBAT_BALANCE.playableTop + PLAYER_RADIUS ||
        y > Math.min(map.height, COMBAT_BALANCE.playableBottom) - PLAYER_RADIUS) return true;

    return map.obstacles.some(obstacle => {
        if (obstacle.type !== 'wall') return false;
        const dx = Math.max(Math.abs(x - obstacle.x) - obstacle.width / 2, 0);
        const dy = Math.max(Math.abs(y - obstacle.y) - obstacle.height / 2, 0);
        return dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS;
    });
}

function smoothStep(progress: number): number {
    const t = Math.max(0, Math.min(1, progress));
    return t * t * (3 - 2 * t);
}

export function acceptMovementInput(
    state: MovementRuntime,
    input: PlayerInput,
    now: number,
    player?: PlayerState
): void {
    const dashPressed = input.dash === true && state.input.dash !== true;
    state.input = { ...input, dash: input.dash === true };
    state.lastInputAt = now;

    if (typeof input.aimAngle === 'number' && Number.isFinite(input.aimAngle)) {
        state.aimAngle = input.aimAngle;
        if (player) player.aimAngle = input.aimAngle;
    }

    if (!dashPressed || !player || player.alive === false || player.spectator ||
        now < state.nextDashAt || (player.immobilizedUntil ?? 0) > now) return;

    const moveX = Number(input.right) - Number(input.left);
    const moveY = Number(input.down) - Number(input.up);
    const direction = moveX === 0 && moveY === 0
        ? { x: Math.cos(state.aimAngle), y: Math.sin(state.aimAngle) }
        : normalize(moveX, moveY);

    if (direction.x === 0 && direction.y === 0) return;
    state.dashStartedAt = now;
    state.dashAppliedProgress = 0;
    state.dashDirectionX = direction.x;
    state.dashDirectionY = direction.y;
    state.nextDashAt = now + DASH_BALANCE.cooldownMs;
    state.dashInvulnerableUntil = now + DASH_BALANCE.invulnerabilityMs;

    player.isDashing = true;
    player.isInvulnerable = true;
    player.dashReadyAt = state.nextDashAt;
}

export function advanceMovement(
    player: PlayerState,
    state: MovementRuntime,
    map: GameMapState,
    deltaMs: number,
    now: number
): boolean {
    if (player.alive === false || player.spectator) {
        player.isDashing = false;
        player.isInvulnerable = now < (player.spawnInvulnerableUntil ?? 0);
        state.dashStartedAt = null;
        return false;
    }

    player.isInvulnerable =
        now < state.dashInvulnerableUntil ||
        now < (player.spawnInvulnerableUntil ?? 0);

    if ((player.immobilizedUntil ?? 0) > now) {
        player.isDashing = false;
        state.dashStartedAt = null;
        return false;
    }

    const oldX = player.x;
    const oldY = player.y;

    if (state.dashStartedAt !== null) {
        const elapsed = Math.max(0, now - state.dashStartedAt);
        const progress = Math.min(1, elapsed / DASH_BALANCE.durationMs);
        const distance = DASH_BALANCE.distancePx *
            (smoothStep(progress) - smoothStep(state.dashAppliedProgress));
        state.dashAppliedProgress = progress;

        const nextX = player.x + state.dashDirectionX * distance;
        const nextY = player.y + state.dashDirectionY * distance;
        const blockedX = blocked(nextX, player.y, map);
        const blockedY = blocked(player.x, nextY, map);

        if (!blockedX) player.x = nextX;
        if (!blockedY) player.y = nextY;

        player.isDashing = elapsed < DASH_BALANCE.durationMs && !blockedX && !blockedY;
        if (progress >= 1 || blockedX || blockedY) {
            state.dashStartedAt = null;
            state.dashAppliedProgress = 0;
            player.isDashing = false;
        }
        return player.x !== oldX || player.y !== oldY;
    }

    player.isDashing = false;
    const input = now - state.lastInputAt <= INPUT_TIMEOUT_MS ? state.input : undefined;
    if (!input) return false;

    const direction = normalize(
        Number(input.right) - Number(input.left),
        Number(input.down) - Number(input.up)
    );
    if (direction.x === 0 && direction.y === 0) return false;

    const delta = Math.max(0, Math.min(deltaMs / 1_000, MAX_STEP_SECONDS));
    const distance = SPEED * delta;
    const nextX = player.x + direction.x * distance;
    const nextY = player.y + direction.y * distance;
    if (!blocked(nextX, player.y, map)) player.x = nextX;
    if (!blocked(player.x, nextY, map)) player.y = nextY;

    return player.x !== oldX || player.y !== oldY;
}
