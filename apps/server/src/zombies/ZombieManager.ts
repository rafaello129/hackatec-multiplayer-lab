import {
    COMBAT_BALANCE,
    ZOMBIE_BALANCE,
    type AcidProjectileState,
    type AcidPuddleState,
    type GameMapState,
    type PlayerState,
    type ZombieHitPayload,
    type ZombieState,
    type ZombieStatePayload
} from '@hackatec/shared';

type Runtime = {
    seed: number;
    zombies: Map<string, ZombieState>;
    projectiles: Map<string, AcidProjectileState>;
    puddles: Map<string, AcidPuddleState>;
    nextSpawnAt: number;
    counter: number;
};

export type ZombieStepResult = {
    state: ZombieStatePayload;
    damage: Array<{ playerId: string; amount: number }>;
};

function randomFor(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
        value = (value + 0x6D2B79F5) >>> 0;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function blocked(x: number, y: number, radius: number, map: GameMapState): boolean {
    if (x < radius || x > map.width - radius ||
        y < COMBAT_BALANCE.playableTop + radius ||
        y > COMBAT_BALANCE.playableBottom - radius) return true;
    return map.obstacles.some(obstacle => {
        if (obstacle.type !== 'wall') return false;
        const dx = Math.max(Math.abs(x - obstacle.x) - obstacle.width / 2, 0);
        const dy = Math.max(Math.abs(y - obstacle.y) - obstacle.height / 2, 0);
        return dx * dx + dy * dy < radius * radius;
    });
}

function blockedSpawn(x: number, y: number, radius: number, map: GameMapState): boolean {
    if (x < radius || x > map.width - radius ||
        y < COMBAT_BALANCE.playableTop + radius ||
        y > COMBAT_BALANCE.playableBottom - radius) return true;
    return map.obstacles.some(obstacle => {
        const dx = Math.max(Math.abs(x - obstacle.x) - obstacle.width / 2, 0);
        const dy = Math.max(Math.abs(y - obstacle.y) - obstacle.height / 2, 0);
        return dx * dx + dy * dy < radius * radius;
    });
}

function nearestPlayer(x: number, y: number, players: PlayerState[]): PlayerState | undefined {
    return players
        .filter(player => player.alive !== false && !player.spectator)
        .map(player => ({ player, distance: Math.hypot(player.x - x, player.y - y) }))
        .sort((a, b) => a.distance - b.distance || a.player.id.localeCompare(b.player.id))[0]?.player;
}

export class ZombieManager {
    private readonly rooms = new Map<string, Runtime>();

    reset(roomId: string, map: GameMapState, players: PlayerState[], now: number): ZombieStatePayload {
        const runtime: Runtime = {
            seed: map.seed >>> 0,
            zombies: new Map(),
            projectiles: new Map(),
            puddles: new Map(),
            nextSpawnAt: now + ZOMBIE_BALANCE.spawnIntervalMs,
            counter: 0
        };
        this.rooms.set(roomId, runtime);

        const positions = this.spawnPositions(map, players, 2, runtime);
        if (positions[0]) this.addZombie(runtime, roomId, 'giant', positions[0], now);
        if (positions[1]) this.addZombie(runtime, roomId, 'spitter', positions[1], now);
        return this.getState(roomId);
    }

    getTargets(roomId: string): ZombieState[] {
        const runtime = this.rooms.get(roomId);
        return runtime ? [...runtime.zombies.values()].filter(zombie => zombie.alive) : [];
    }

    getState(roomId: string): ZombieStatePayload {
        const runtime = this.rooms.get(roomId);
        if (!runtime) return { roomId, zombies: [], projectiles: [], puddles: [] };
        return {
            roomId,
            zombies: [...runtime.zombies.values()].map(zombie => ({ ...zombie })),
            projectiles: [...runtime.projectiles.values()].map(projectile => ({ ...projectile })),
            puddles: [...runtime.puddles.values()].map(puddle => ({ ...puddle }))
        };
    }

    applyHits(roomId: string, hits: ZombieHitPayload[], players: PlayerState[]): boolean {
        const runtime = this.rooms.get(roomId);
        if (!runtime || hits.length === 0) return false;
        const playerById = new Map(players.map(player => [player.id, player]));
        let changed = false;
        for (const hit of hits) {
            const zombie = runtime.zombies.get(hit.zombieId);
            if (!zombie || !zombie.alive || !Number.isFinite(hit.damage) || hit.damage <= 0) continue;
            zombie.hp = Math.max(0, zombie.hp - hit.damage);
            changed = true;
            if (zombie.hp <= 0) {
                zombie.alive = false;
                const attacker = playerById.get(hit.attackerId);
                if (attacker) attacker.zombieKills = (attacker.zombieKills ?? 0) + 1;
            }
        }
        return changed;
    }

    step(roomId: string, players: PlayerState[], map: GameMapState, dtMs: number, now: number): ZombieStepResult | undefined {
        const runtime = this.rooms.get(roomId);
        if (!runtime) return undefined;
        const dt = Math.max(0, Math.min(dtMs, COMBAT_BALANCE.serverTickMs)) / 1_000;
        const damage: Array<{ playerId: string; amount: number }> = [];
        const activePlayers = players.filter(player => player.alive !== false && !player.spectator);

        this.advanceSpawns(runtime, roomId, map, activePlayers, now);
        this.advanceAcid(runtime, activePlayers, map, dt, now, damage);

        for (const zombie of runtime.zombies.values()) {
            if (!zombie.alive || activePlayers.length === 0) continue;
            const target = nearestPlayer(zombie.x, zombie.y, activePlayers);
            if (!target) continue;
            zombie.targetId = target.id;
            if (zombie.type !== 'giant' || (zombie.phase !== 'telegraph' && zombie.phase !== 'charge')) {
                zombie.angle = Math.atan2(target.y - zombie.y, target.x - zombie.x);
            }

            if (zombie.type === 'giant') {
                this.stepGiant(zombie, target, map, dt, now, damage);
            } else {
                this.stepSpitter(zombie, target, runtime, roomId, dt, now, map);
            }
        }

        return { state: this.getState(roomId), damage };
    }

    removeRoom(roomId: string): void {
        this.rooms.delete(roomId);
    }

    private addZombie(
        runtime: Runtime,
        roomId: string,
        type: ZombieState['type'],
        position: { x: number; y: number },
        now: number
    ): void {
        const giant = type === 'giant';
        const balance = giant ? ZOMBIE_BALANCE.giant : ZOMBIE_BALANCE.spitter;
        const id = roomId + ':zombie:' + (++runtime.counter);
        runtime.zombies.set(id, {
            id,
            type,
            x: position.x,
            y: position.y,
            hp: balance.health,
            maxHp: balance.health,
            radius: giant ? 29 : 22,
            alive: true,
            phase: 'approach',
            phaseEndsAt: now,
            targetId: null,
            angle: 0
        });
    }

    private advanceSpawns(
        runtime: Runtime,
        roomId: string,
        map: GameMapState,
        players: PlayerState[],
        now: number
    ): void {
        if (now < runtime.nextSpawnAt) return;
        const aliveCount = [...runtime.zombies.values()].filter(zombie => zombie.alive).length;
        if (aliveCount < ZOMBIE_BALANCE.maximumAlive) {
            const positions = this.spawnPositions(map, players, 1, runtime);
            if (positions[0]) {
                const alive = [...runtime.zombies.values()].filter(zombie => zombie.alive);
                const type = alive.length % 2 === 0 ? 'giant' : 'spitter';
                this.addZombie(runtime, roomId, type, positions[0], now);
            }
        }
        runtime.nextSpawnAt = now + ZOMBIE_BALANCE.spawnIntervalMs;
    }

    private spawnPositions(
        map: GameMapState,
        players: PlayerState[],
        count: number,
        runtime: Runtime
    ): Array<{ x: number; y: number }> {
        const candidates: Array<{ x: number; y: number }> = [];
        // Full rooms occupy almost every spawn grid cell; keep a smaller, safe buffer
        // at high occupancy rather than silently disabling zombie spawns.
        const minimumPlayerDistance = players.length >= 16 ? 75 : players.length >= 8 ? 130 : 190;
        const minimumZombieSeparation = players.length >= 16 ? 90 : 180;
        for (let y = COMBAT_BALANCE.playableTop + 45; y <= COMBAT_BALANCE.playableBottom - 45; y += 55) {
            for (let x = 55; x <= map.width - 55; x += 60) {
                if (blockedSpawn(x, y, 32, map)) continue;
                if (players.some(player => Math.hypot(player.x - x, player.y - y) < minimumPlayerDistance)) continue;
                candidates.push({ x, y });
            }
        }
        const random = randomFor(runtime.seed ^ runtime.counter ^ 0xA511E9B3);
        for (let index = candidates.length - 1; index > 0; index -= 1) {
            const target = Math.floor(random() * (index + 1));
            [candidates[index], candidates[target]] = [candidates[target]!, candidates[index]!];
        }
        const selected: Array<{ x: number; y: number }> = [];
        for (const candidate of candidates) {
            if (selected.some(point => Math.hypot(point.x - candidate.x, point.y - candidate.y) < minimumZombieSeparation)) continue;
            selected.push(candidate);
            if (selected.length >= count) break;
        }
        return selected;
    }

    private stepGiant(
        zombie: ZombieState,
        target: PlayerState,
        map: GameMapState,
        dt: number,
        now: number,
        damage: Array<{ playerId: string; amount: number }>
    ): void {
        const balance = ZOMBIE_BALANCE.giant;
        if (zombie.phase === 'stunned') {
            if (now < zombie.phaseEndsAt) return;
            zombie.phase = 'approach';
            zombie.phaseEndsAt = now;
        }

        if (zombie.phase === 'telegraph') {
            if (now < zombie.phaseEndsAt) return;
            zombie.phase = 'charge';
            zombie.phaseEndsAt = now + 650;
        }

        if (zombie.phase === 'charge') {
            const nextX = zombie.x + Math.cos(zombie.angle) * balance.chargeSpeed * dt;
            const nextY = zombie.y + Math.sin(zombie.angle) * balance.chargeSpeed * dt;
            if (blocked(nextX, nextY, zombie.radius, map)) {
                zombie.phase = 'stunned';
                zombie.phaseEndsAt = now + balance.stunnedMs;
                return;
            }
            zombie.x = nextX;
            zombie.y = nextY;
            if (Math.hypot(target.x - zombie.x, target.y - zombie.y) <= zombie.radius + COMBAT_BALANCE.playerRadius) {
                damage.push({ playerId: target.id, amount: balance.chargeDamage });
                zombie.phase = 'approach';
                zombie.phaseEndsAt = now + balance.cooldownMs;
                return;
            }
            if (now >= zombie.phaseEndsAt) {
                zombie.phase = 'approach';
                zombie.phaseEndsAt = now + balance.cooldownMs;
            }
            return;
        }

        const dx = target.x - zombie.x;
        const dy = target.y - zombie.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance <= 220 && now >= zombie.phaseEndsAt) {
            zombie.phase = 'telegraph';
            zombie.phaseEndsAt = now + balance.telegraphMs;
            zombie.angle = Math.atan2(dy, dx);
            zombie.targetId = target.id;
            return;
        }

        const speed = balance.moveSpeed * dt;
        const nextX = zombie.x + dx / distance * speed;
        const nextY = zombie.y + dy / distance * speed;
        if (!blocked(nextX, zombie.y, zombie.radius, map)) zombie.x = nextX;
        if (!blocked(zombie.x, nextY, zombie.radius, map)) zombie.y = nextY;
    }

    private stepSpitter(
        zombie: ZombieState,
        target: PlayerState,
        runtime: Runtime,
        roomId: string,
        dt: number,
        now: number,
        map: GameMapState
    ): void {
        if (zombie.phase === 'spit' && now < zombie.phaseEndsAt) return;
        if (zombie.phase === 'spit') zombie.phase = 'approach';

        const balance = ZOMBIE_BALANCE.spitter;
        const dx = target.x - zombie.x;
        const dy = target.y - zombie.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < balance.fleeRange) {
            const nextX = zombie.x - dx / distance * balance.moveSpeed * dt;
            const nextY = zombie.y - dy / distance * balance.moveSpeed * dt;
            if (!blocked(nextX, zombie.y, zombie.radius, map)) zombie.x = nextX;
            if (!blocked(zombie.x, nextY, zombie.radius, map)) zombie.y = nextY;
            return;
        }
        if (distance > balance.preferredRange + 35) {
            const nextX = zombie.x + dx / distance * balance.moveSpeed * dt;
            const nextY = zombie.y + dy / distance * balance.moveSpeed * dt;
            if (!blocked(nextX, zombie.y, zombie.radius, map)) zombie.x = nextX;
            if (!blocked(zombie.x, nextY, zombie.radius, map)) zombie.y = nextY;
            return;
        }

        zombie.phase = 'spit';
        zombie.phaseEndsAt = now + balance.cooldownMs;
        zombie.angle = Math.atan2(dy, dx);
        const id = roomId + ':acid:' + (++runtime.counter);
        runtime.projectiles.set(id, {
            id,
            x: zombie.x,
            y: zombie.y,
            vx: Math.cos(zombie.angle) * balance.projectileSpeed,
            vy: Math.sin(zombie.angle) * balance.projectileSpeed,
            createdAt: now
        });
    }

    private advanceAcid(
        runtime: Runtime,
        players: PlayerState[],
        map: GameMapState,
        dt: number,
        now: number,
        damage: Array<{ playerId: string; amount: number }>
    ): void {
        const balance = ZOMBIE_BALANCE.spitter;
        for (const [id, projectile] of runtime.projectiles) {
            const nextX = projectile.x + projectile.vx * dt;
            const nextY = projectile.y + projectile.vy * dt;
            const hitWall = blocked(nextX, nextY, balance.projectileRadius, map);
            const target = players.find(player =>
                Math.hypot(player.x - nextX, player.y - nextY) <= COMBAT_BALANCE.playerRadius + balance.projectileRadius
            );
            projectile.x = nextX;
            projectile.y = nextY;
            if (hitWall || target || now - projectile.createdAt >= balance.projectileLifetimeMs) {
                if (target) damage.push({ playerId: target.id, amount: balance.projectileDamage });
                this.createPuddle(runtime, id, projectile.x, projectile.y, now);
                runtime.projectiles.delete(id);
            }
        }

        for (const [id, puddle] of runtime.puddles) {
            if (now >= puddle.expiresAt) {
                runtime.puddles.delete(id);
                continue;
            }
            for (const player of players) {
                if (Math.hypot(player.x - puddle.x, player.y - puddle.y) <= puddle.radius) {
                    damage.push({ playerId: player.id, amount: balance.puddleDamagePerSecond * dt });
                }
            }
        }
    }

    private createPuddle(runtime: Runtime, id: string, x: number, y: number, now: number): void {
        const balance = ZOMBIE_BALANCE.spitter;
        runtime.puddles.set(id + ':puddle', {
            id: id + ':puddle',
            x,
            y,
            radius: balance.puddleRadius,
            expiresAt: now + balance.puddleDurationMs
        });
    }
}
