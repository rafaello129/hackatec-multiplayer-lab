import {
    COMBAT_BALANCE,
    PICKUP_BALANCE,
    type GameMapState,
    type PickupCollectedPayload,
    type PickupState,
    type PlayerState
} from '@hackatec/shared';
import { getSpawnPosition } from '../game/spawn.js';

type RoomPickupState = { pickups: PickupState[] };
export type PickupStepResult = {
    changed: boolean;
    pickups: PickupState[];
    collected: PickupCollectedPayload[];
};

const PICKUP_RADIUS = PICKUP_BALANCE.radiusPx;
const PLAYER_RADIUS = COMBAT_BALANCE.playerRadius;

function seededRandom(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
        value = (value + 0x6D2B79F5) >>> 0;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function intersectsObstacle(x: number, y: number, radius: number, map: GameMapState): boolean {
    return map.obstacles.some(obstacle => {
        const dx = Math.max(Math.abs(x - obstacle.x) - obstacle.width / 2, 0);
        const dy = Math.max(Math.abs(y - obstacle.y) - obstacle.height / 2, 0);
        return dx * dx + dy * dy < radius * radius;
    });
}

function createPickupPositions(map: GameMapState, count: number): Array<{ x: number; y: number }> {
    const candidates: Array<{ x: number; y: number }> = [];
    for (let y = COMBAT_BALANCE.playableTop + PICKUP_BALANCE.spawnMarginY;
        y <= COMBAT_BALANCE.playableBottom - PICKUP_BALANCE.spawnMarginY;
        y += PICKUP_BALANCE.spawnGridY) {
        for (let x = PICKUP_BALANCE.spawnMarginX;
            x <= map.width - PICKUP_BALANCE.spawnMarginX;
            x += PICKUP_BALANCE.spawnGridX) {
            if (intersectsObstacle(x, y, PICKUP_RADIUS + PICKUP_BALANCE.obstaclePaddingPx, map)) continue;
            candidates.push({ x, y });
        }
    }

    const random = seededRandom(map.seed ^ 0x9E3779B9);
    for (let index = candidates.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [candidates[index], candidates[swapIndex]] = [candidates[swapIndex]!, candidates[index]!];
    }

    const selected: Array<{ x: number; y: number }> = [];
    for (const candidate of candidates) {
        if (selected.some(point => Math.hypot(point.x - candidate.x, point.y - candidate.y) < PICKUP_BALANCE.minimumSpacingPx)) continue;
        selected.push(candidate);
        if (selected.length >= count) break;
    }

    // Deterministic fallback for unusually dense maps; the fallback is still obstacle-checked.
    if (selected.length < count) {
        for (let index = 0; index < PICKUP_BALANCE.fallbackSpawnCount && selected.length < count; index += 1) {
            const spawn = getSpawnPosition(index, map.width, map.height);
            const point = { x: spawn.x, y: spawn.y };
            if (intersectsObstacle(point.x, point.y, PICKUP_RADIUS + PICKUP_BALANCE.obstaclePaddingPx, map)) continue;
            if (selected.some(existing => Math.hypot(existing.x - point.x, existing.y - point.y) < PICKUP_BALANCE.fallbackMinimumSpacingPx)) continue;
            selected.push(point);
        }
    }

    return selected;
}

export class PickupManager {
    private readonly rooms = new Map<string, RoomPickupState>();

    reset(roomId: string, map: GameMapState): PickupState[] {
        const types = ['medkit', 'shield', 'shield', 'medkit', 'shield', 'shield', 'medkit'] as const;
        const positions = createPickupPositions(map, types.length);
        const pickups = types.slice(0, positions.length).map((type, index): PickupState => ({
            id: roomId + ':pickup:' + index,
            type,
            x: positions[index]!.x,
            y: positions[index]!.y,
            active: true,
            respawnAt: null
        }));
        this.rooms.set(roomId, { pickups });
        return this.getState(roomId);
    }

    getState(roomId: string): PickupState[] {
        return (this.rooms.get(roomId)?.pickups ?? []).map(pickup => ({ ...pickup }));
    }

    step(roomId: string, players: PlayerState[], mode: string | null, now: number): PickupStepResult {
        const room = this.rooms.get(roomId);
        if (!room) return { changed: false, pickups: [], collected: [] };

        let changed = false;
        const collected: PickupCollectedPayload[] = [];
        for (const pickup of room.pickups) {
            if (!pickup.active && pickup.respawnAt !== null && now >= pickup.respawnAt) {
                pickup.active = true;
                pickup.respawnAt = null;
                changed = true;
            }
            if (!pickup.active) continue;

            const eligible = players
                .filter(player => player.alive !== false && !player.spectator)
                .filter(player => pickup.type === 'medkit'
                    ? (player.hp ?? PICKUP_BALANCE.maxHealth) < (player.maxHp ?? PICKUP_BALANCE.maxHealth)
                    : (player.shield ?? 0) < PICKUP_BALANCE.maxShield)
                .map(player => ({ player, distance: Math.hypot(player.x - pickup.x, player.y - pickup.y) }))
                .filter(item => item.distance <= PLAYER_RADIUS + PICKUP_RADIUS)
                .sort((a, b) => a.distance - b.distance || a.player.id.localeCompare(b.player.id));

            const winner = eligible[0]?.player;
            if (!winner) continue;

            let restored = 0;
            if (pickup.type === 'medkit') {
                const before = winner.hp ?? PICKUP_BALANCE.maxHealth;
                const maximum = winner.maxHp ?? PICKUP_BALANCE.maxHealth;
                const after = Math.min(maximum, before + PICKUP_BALANCE.medkitHealth);
                restored = after - before;
                winner.hp = after;
            } else {
                const before = winner.shield ?? 0;
                const after = Math.min(PICKUP_BALANCE.maxShield, before + PICKUP_BALANCE.shieldAmount);
                restored = after - before;
                winner.shield = after;
            }

            if (restored <= 0) continue;
            pickup.active = false;
            const respawnMs = pickup.type === 'medkit'
                ? mode === 'battleRoyale'
                    ? PICKUP_BALANCE.battleRoyaleMedkitRespawnMs
                    : PICKUP_BALANCE.medkitRespawnMs
                : mode === 'battleRoyale'
                    ? PICKUP_BALANCE.battleRoyaleRespawnMs
                    : PICKUP_BALANCE.respawnMs;
            pickup.respawnAt = now + respawnMs;
            changed = true;
            collected.push({
                pickupId: pickup.id,
                type: pickup.type,
                playerId: winner.id,
                restored
            });
        }

        return { changed, pickups: this.getState(roomId), collected };
    }

    removeRoom(roomId: string): void {
        this.rooms.delete(roomId);
    }
}
