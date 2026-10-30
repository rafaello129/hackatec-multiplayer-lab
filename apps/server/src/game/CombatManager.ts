import {
    COMBAT_BALANCE,
    MATCH_BALANCE,
    WEAPON_BALANCE,
    WEAPON_TEXTS,
    PICKUP_BALANCE,
    type ExplosionState,
    type GameMapState,
    type LaserBeamState,
    type PlayerState,
    type ProjectileState,
    type ProjectileWeaponType,
    type PlayerTrappedPayload,
    type PlayerHealedPayload,
    type WeaponFirePayload,
    type WeaponSlot,
    type WeaponStatePayload,
    type WeaponType
} from '@hackatec/shared';
import { availableWeaponSlots, WEAPON_DEFINITIONS, weaponForSlot } from '../weapons/registry.js';
import { getSpawnPosition } from './spawn.js';

type WeaponRuntime = {
    selectedSlot: WeaponSlot;
    cooldownUntil: number;
    lastSelectionAt: number;
    lastIntentAt: number;
    angle: number;
    firing: boolean;
    justPressed: boolean;
    laserEnergyMs: number;
};

type KnockbackRuntime = { vx: number; vy: number; endsAt: number };

type Runtime = {
    projectiles: Map<string, ProjectileState>;
    cooldowns: Map<string, number>;
    invulnerable: Map<string, number>;
    cactus: Map<string, number>;
    traps: Map<string, Set<string>>;
    respawn: Map<string, number>;
    weapons: Map<string, WeaponRuntime>;
    laserOwners: Set<string>;
    knockback: Map<string, KnockbackRuntime>;
    projectileCounter: number;
    explosionCounter: number;
    heals: PlayerHealedPayload[];
    mode: string | null;
};

export type CombatStepResult = {
    projectiles: ProjectileState[];
    beams: LaserBeamState[];
    explosions: ExplosionState[];
    trapped: PlayerTrappedPayload[];
    heals: PlayerHealedPayload[];
};

export type WeaponActionResult = { ok: boolean; message: string };

const normalizeAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

function overlaps(x: number, y: number, radius: number, obstacle: { x: number; y: number; width: number; height: number }): boolean {
    const dx = Math.max(Math.abs(x - obstacle.x) - obstacle.width / 2, 0);
    const dy = Math.max(Math.abs(y - obstacle.y) - obstacle.height / 2, 0);
    return dx * dx + dy * dy < radius * radius;
}

function blocked(x: number, y: number, map: GameMapState): boolean {
    const radius = COMBAT_BALANCE.playerRadius;
    if (x < radius || x > map.width - radius ||
        y < COMBAT_BALANCE.playableTop + radius ||
        y > COMBAT_BALANCE.playableBottom - radius) return true;
    return map.obstacles.some(obstacle =>
        obstacle.type === 'wall' && overlaps(x, y, radius, obstacle)
    );
}

export class CombatManager {
    private readonly rooms = new Map<string, Runtime>();

    private runtime(roomId: string): Runtime {
        let state = this.rooms.get(roomId);
        if (!state) {
            state = {
                projectiles: new Map(),
                cooldowns: new Map(),
                invulnerable: new Map(),
                cactus: new Map(),
                traps: new Map(),
                respawn: new Map(),
                weapons: new Map(),
                laserOwners: new Set(),
                knockback: new Map(),
                projectileCounter: 0,
                explosionCounter: 0,
                heals: [],
                mode: null
            };
            this.rooms.set(roomId, state);
        }
        return state;
    }

    private weaponRuntime(state: Runtime, playerId: string): WeaponRuntime {
        let weapon = state.weapons.get(playerId);
        if (!weapon) {
            weapon = {
                selectedSlot: 4,
                cooldownUntil: 0,
                lastSelectionAt: Number.NEGATIVE_INFINITY,
                lastIntentAt: 0,
                angle: 0,
                firing: false,
                justPressed: false,
                laserEnergyMs: WEAPON_BALANCE.laser.energyMs
            };
            state.weapons.set(playerId, weapon);
        }
        return weapon;
    }

    initializePlayer(roomId: string, player: PlayerState, canUseLaser: boolean, mode: string | null = null): WeaponStatePayload {
        const state = this.runtime(roomId);
        if (canUseLaser) state.laserOwners.add(player.id);
        else state.laserOwners.delete(player.id);
        const weapon = this.weaponRuntime(state, player.id);
        player.selectedWeapon = weaponForSlot(weapon.selectedSlot) ?? 'pistol';
        return this.getWeaponState(roomId, player.id, Date.now(), mode);
    }

    resetRoom(roomId: string): void {
        const state = this.rooms.get(roomId);
        if (!state) return;
        state.projectiles.clear();
        state.cooldowns.clear();
        state.invulnerable.clear();
        state.cactus.clear();
        state.traps.clear();
        state.respawn.clear();
        state.weapons.clear();
        state.knockback.clear();
    }

    leave(roomId: string, playerId: string, roomEmpty: boolean): void {
        if (roomEmpty) {
            this.rooms.delete(roomId);
            return;
        }
        const state = this.rooms.get(roomId);
        if (!state) return;
        state.cooldowns.delete(playerId);
        state.invulnerable.delete(playerId);
        state.cactus.delete(playerId);
        state.traps.delete(playerId);
        state.respawn.delete(playerId);
        state.weapons.delete(playerId);
        state.laserOwners.delete(playerId);
        state.knockback.delete(playerId);
        for (const [id, projectile] of state.projectiles) {
            if (projectile.ownerId === playerId) state.projectiles.delete(id);
        }
    }

    selectWeapon(roomId: string, player: PlayerState, slotValue: number, mode: string | null, now: number): WeaponActionResult {
        if (!Number.isInteger(slotValue) || slotValue < 1 || slotValue > 7) {
            return { ok: false, message: WEAPON_TEXTS.errors.invalidSlot };
        }
        if (player.alive === false || player.spectator) {
            return { ok: false, message: WEAPON_TEXTS.errors.modeLocked };
        }

        const state = this.runtime(roomId);
        const weapon = this.weaponRuntime(state, player.id);
        if (now - weapon.lastSelectionAt < 120) {
            return { ok: false, message: WEAPON_TEXTS.errors.rateLimit };
        }
        const allowedSlots = availableWeaponSlots(state.laserOwners.has(player.id), mode);
        if (!allowedSlots.includes(slotValue as WeaponSlot)) {
            return {
                ok: false,
                message: slotValue === 7 ? WEAPON_TEXTS.errors.unavailable : WEAPON_TEXTS.errors.modeLocked
            };
        }
        const nextWeapon = weaponForSlot(slotValue);
        if (!nextWeapon) return { ok: false, message: WEAPON_TEXTS.errors.invalidSlot };

        weapon.lastSelectionAt = now;
        weapon.selectedSlot = slotValue as WeaponSlot;
        weapon.firing = false;
        weapon.justPressed = false;
        player.selectedWeapon = nextWeapon;
        return { ok: true, message: WEAPON_TEXTS.selected };
    }

    setFireIntent(roomId: string, player: PlayerState, payload: unknown, now: number): void {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
        const request = payload as Partial<WeaponFirePayload>;
        if (typeof request.angle !== 'number' || !Number.isFinite(request.angle) ||
            Math.abs(request.angle) > Math.PI || typeof request.firing !== 'boolean') return;

        const state = this.runtime(roomId);
        const weapon = this.weaponRuntime(state, player.id);
        if (request.firing && now - weapon.lastIntentAt < 35) return;

        weapon.angle = request.angle;
        weapon.lastIntentAt = now;
        if (request.firing && !weapon.firing) weapon.justPressed = true;
        weapon.firing = request.firing;
    }

    getWeaponState(roomId: string, playerId: string, now: number, mode: string | null = null): WeaponStatePayload {
        const state = this.runtime(roomId);
        const weapon = this.weaponRuntime(state, playerId);
        const selectedWeapon = weaponForSlot(weapon.selectedSlot) ?? 'pistol';
        return {
            selectedSlot: weapon.selectedSlot,
            selectedWeapon,
            availableSlots: availableWeaponSlots(state.laserOwners.has(playerId), mode),
            cooldownRemainingMs: Math.max(0, weapon.cooldownUntil - now),
            laserEnergyMs: Math.floor(weapon.laserEnergyMs),
            laserEnergyMaxMs: WEAPON_BALANCE.laser.energyMs
        };
    }

    step(
        roomId: string,
        players: PlayerState[],
        map: GameMapState,
        dtMs: number,
        now: number,
        mode: string | null = 'classic'
    ): CombatStepResult {
        const state = this.runtime(roomId);
        state.mode = mode;
        const dt = Math.min(Math.max(dtMs, 0), COMBAT_BALANCE.serverTickMs);
        const explosions: ExplosionState[] = [];
        const beams: LaserBeamState[] = [];
        const trapped: PlayerTrappedPayload[] = [];
        state.heals = [];
        const byId = new Map(players.map(player => [player.id, player]));
        const playerRadius = COMBAT_BALANCE.playerRadius;
        const projectileRadius = COMBAT_BALANCE.projectileRadius;

        this.applyKnockback(state, players, map, dt, now);

        for (const player of players) {
            if (player.spectator) continue;
            if (player.alive === false) {
                const respawnAt = state.respawn.get(player.id) ?? Number.POSITIVE_INFINITY;
                if (now >= respawnAt) {
                    const candidates = Array.from({ length: 32 }, (_, index) => getSpawnPosition(index));
                    const spawn = candidates.find(point =>
                        !map.obstacles.some(obstacle => obstacle.type === 'wall' && overlaps(point.x, point.y, playerRadius, obstacle)) &&
                        !players.some(other => other.id !== player.id && other.alive !== false &&
                            !other.spectator && Math.hypot(other.x - point.x, other.y - point.y) < playerRadius * 2)
                    ) ?? getSpawnPosition(players.findIndex(item => item.id === player.id));
                    player.x = spawn.x;
                    player.y = spawn.y;
                    player.hp = MATCH_BALANCE.initialHealth;
                    player.maxHp = MATCH_BALANCE.initialHealth;
                    player.shield = 0;
                    player.alive = true;
                    player.immobilizedUntil = 0;
                    player.isInvulnerable = true;
                    state.traps.delete(player.id);
                    state.invulnerable.set(player.id, now + COMBAT_BALANCE.respawnInvulnerabilityMs);
                    state.respawn.delete(player.id);
                }
                continue;
            }

            const touching = new Set<string>();
            const previousTraps = state.traps.get(player.id) ?? new Set<string>();
            for (const obstacle of map.obstacles) {
                if (obstacle.type === 'wall' || !overlaps(player.x, player.y, playerRadius, obstacle)) continue;
                if (obstacle.type === 'trap') {
                    touching.add(obstacle.id);
                    if (!player.isDashing && !previousTraps.has(obstacle.id) &&
                        (player.immobilizedUntil ?? 0) <= now) {
                        player.immobilizedUntil = now + COMBAT_BALANCE.trapDurationMs;
                        trapped.push({ playerId: player.id, trappedUntil: player.immobilizedUntil });
                    }
                }
                if (obstacle.type === 'cactus' && now >= (state.cactus.get(player.id) ?? 0)) {
                    this.damage(state, player, obstacle.damage, now);
                    state.cactus.set(player.id, now + COMBAT_BALANCE.cactusDamageCooldownMs);
                }
            }
            state.traps.set(player.id, touching);
            this.processWeapon(state, roomId, player, players, map, dt, now, mode, beams);
        }

        this.stepProjectiles(state, roomId, players, map, dt, now, explosions, byId);

        return {
            projectiles: [...state.projectiles.values()],
            beams,
            explosions,
            trapped,
            heals: [...state.heals]
        };
    }

    private processWeapon(
        state: Runtime,
        roomId: string,
        player: PlayerState,
        players: PlayerState[],
        map: GameMapState,
        dtMs: number,
        now: number,
        mode: string | null,
        beams: LaserBeamState[]
    ): void {
        const weaponState = this.weaponRuntime(state, player.id);
        if (weaponState.firing && now - weaponState.lastIntentAt > 220) weaponState.firing = false;

        let weapon = weaponForSlot(weaponState.selectedSlot) ?? 'pistol';
        if (mode === 'rockets' && weapon !== 'rocketLauncher') {
            weaponState.selectedSlot = 6;
            weaponState.firing = false;
            weaponState.justPressed = false;
            weapon = 'rocketLauncher';
            player.selectedWeapon = weapon;
        }
        const definition = WEAPON_DEFINITIONS[weapon];
        const shouldFire = definition.fireMode === 'semi'
            ? weaponState.justPressed
            : weaponState.firing || weaponState.justPressed;
        weaponState.justPressed = false;

        if (!shouldFire || player.alive === false || player.spectator) {
            this.rechargeLaser(weaponState, dtMs);
            return;
        }
        if (now < weaponState.cooldownUntil) return;

        if (weapon === 'laser') {
            if (weaponState.laserEnergyMs <= 0) {
                weaponState.firing = false;
                this.rechargeLaser(weaponState, dtMs);
                return;
            }
            const energyUsed = Math.min(WEAPON_BALANCE.laser.tickMs, weaponState.laserEnergyMs);
            const trace = this.traceRay(player, weaponState.angle, WEAPON_BALANCE.laser.range, players, map);
            beams.push({ ownerId: player.id, x1: player.x, y1: player.y, x2: trace.x, y2: trace.y });
            if (trace.target) {
                this.damage(state, trace.target, WEAPON_BALANCE.laser.damagePerSecond * energyUsed / 1_000, now, player);
            }
            weaponState.laserEnergyMs = Math.max(0, weaponState.laserEnergyMs - energyUsed);
            weaponState.cooldownUntil = now + WEAPON_BALANCE.laser.tickMs;
            if (weaponState.laserEnergyMs <= 0) weaponState.firing = false;
            return;
        }

        weaponState.cooldownUntil = now + definition.cooldownMs;
        switch (weapon) {
            case 'knife':
                this.fireKnife(state, player, players, now, weaponState.angle);
                break;
            case 'sniper': {
                const trace = this.traceRay(player, weaponState.angle, WEAPON_BALANCE.sniper.range, players, map);
                if (trace.target) this.damage(state, trace.target, WEAPON_BALANCE.sniper.damage, now, player);
                break;
            }
            case 'rocketLauncher':
                this.spawnProjectile(state, roomId, player, 'rocketLauncher', weaponState.angle, WEAPON_BALANCE.rocketLauncher.projectileSpeed, now);
                break;
            case 'machineGun':
                this.spawnProjectile(state, roomId, player, 'machineGun', weaponState.angle,
                    WEAPON_BALANCE.machineGun.projectileSpeed, now);
                break;
            case 'shotgun':
                for (const offset of WEAPON_BALANCE.shotgun.spreadRadians) {
                    this.spawnProjectile(state, roomId, player, 'shotgun', weaponState.angle + offset,
                        WEAPON_BALANCE.shotgun.projectileSpeed, now);
                }
                break;
            case 'pistol':
                this.spawnProjectile(state, roomId, player, 'pistol', weaponState.angle,
                    WEAPON_BALANCE.pistol.projectileSpeed, now);
                break;
            default:
                break;
        }

    }

    private rechargeLaser(weapon: WeaponRuntime, dtMs: number): void {
        const rechargePerMs = WEAPON_BALANCE.laser.energyMs / WEAPON_BALANCE.laser.rechargeMs;
        weapon.laserEnergyMs = Math.min(
            WEAPON_BALANCE.laser.energyMs,
            weapon.laserEnergyMs + Math.max(0, dtMs) * rechargePerMs
        );
    }

    private fireKnife(
        state: Runtime,
        attacker: PlayerState,
        players: PlayerState[],
        now: number,
        angle: number
    ): void {
        let nearest: PlayerState | undefined;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const target of players) {
            if (target.id === attacker.id || target.alive === false || target.spectator) continue;
            const dx = target.x - attacker.x;
            const dy = target.y - attacker.y;
            const distance = Math.hypot(dx, dy);
            if (distance > WEAPON_BALANCE.knife.range + COMBAT_BALANCE.playerRadius) continue;
            const offset = Math.abs(normalizeAngle(Math.atan2(dy, dx) - angle));
            if (offset > WEAPON_BALANCE.knife.arcRadians) continue;
            if (distance < nearestDistance) {
                nearest = target;
                nearestDistance = distance;
            }
        }
        if (nearest) this.damage(state, nearest, WEAPON_BALANCE.knife.damage, now, attacker);
    }

    private traceRay(
        attacker: PlayerState,
        angle: number,
        range: number,
        players: PlayerState[],
        map: GameMapState
    ): { x: number; y: number; target?: PlayerState } {
        const step = 6;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        for (let distance = step; distance <= range; distance += step) {
            const x = attacker.x + dx * distance;
            const y = attacker.y + dy * distance;
            if (x < 0 || x > map.width || y < COMBAT_BALANCE.playableTop || y > COMBAT_BALANCE.playableBottom ||
                map.obstacles.some(obstacle => obstacle.type === 'wall' && overlaps(x, y, 1, obstacle))) {
                return { x, y };
            }
            const target = players.find(player =>
                player.id !== attacker.id && player.alive !== false && !player.spectator &&
                Math.hypot(player.x - x, player.y - y) <= COMBAT_BALANCE.playerRadius
            );
            if (target) return { x, y, target };
        }
        return { x: attacker.x + dx * range, y: attacker.y + dy * range };
    }

    private spawnProjectile(
        state: Runtime,
        roomId: string,
        player: PlayerState,
        weapon: ProjectileWeaponType,
        angle: number,
        speed: number,
        now: number
    ): void {
        const id = roomId + ':' + (++state.projectileCounter);
        state.projectiles.set(id, {
            id,
            ownerId: player.id,
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            weapon,
            createdAt: now
        });
    }

    private stepProjectiles(
        state: Runtime,
        roomId: string,
        players: PlayerState[],
        map: GameMapState,
        dtMs: number,
        now: number,
        explosions: ExplosionState[],
        byId: Map<string, PlayerState>
    ): void {
        const dt = Math.min(Math.max(dtMs, 0), COMBAT_BALANCE.serverTickMs) / 1_000;
        for (const [id, projectile] of state.projectiles) {
            const speedDistance = Math.hypot(projectile.vx * dt, projectile.vy * dt);
            const segments = Math.max(1, Math.ceil(speedDistance / COMBAT_BALANCE.maxProjectileSubstepPx));
            let hit = false;
            let impactTarget: PlayerState | undefined;

            if (projectile.weapon === 'rocketLauncher' &&
                now - (projectile.createdAt ?? now) >= WEAPON_BALANCE.rocketLauncher.lifetimeMs) {
                hit = true;
            }

            for (let index = 0; index < segments && !hit; index += 1) {
                projectile.x += projectile.vx * dt / segments;
                projectile.y += projectile.vy * dt / segments;
                if (projectile.x < 0 || projectile.x > map.width ||
                    projectile.y < COMBAT_BALANCE.playableTop ||
                    projectile.y > COMBAT_BALANCE.playableBottom ||
                    map.obstacles.some(obstacle => obstacle.type === 'wall' &&
                        overlaps(projectile.x, projectile.y, COMBAT_BALANCE.projectileRadius, obstacle))) {
                    hit = true;
                    break;
                }
                impactTarget = players.find(target =>
                    target.id !== projectile.ownerId && target.alive !== false && !target.spectator &&
                    Math.hypot(target.x - projectile.x, target.y - projectile.y) <=
                        COMBAT_BALANCE.playerRadius + COMBAT_BALANCE.projectileRadius
                );
                if (impactTarget) hit = true;
            }

            if (hit) {
                if (projectile.weapon === 'rocketLauncher') {
                    this.explode(state, roomId, projectile, players, now, explosions);
                } else if (impactTarget) {
                    const damage = projectile.weapon === 'machineGun'
                        ? WEAPON_BALANCE.machineGun.damage
                        : projectile.weapon === 'shotgun'
                            ? WEAPON_BALANCE.shotgun.damagePerPellet
                            : WEAPON_BALANCE.pistol.damage;
                    this.damage(state, impactTarget, damage, now, byId.get(projectile.ownerId));
                }
                state.projectiles.delete(id);
            }
        }
    }

    private explode(
        state: Runtime,
        roomId: string,
        projectile: ProjectileState,
        players: PlayerState[],
        now: number,
        explosions: ExplosionState[]
    ): void {
        const balance = WEAPON_BALANCE.rocketLauncher;
        explosions.push({
            id: roomId + ':explosion:' + (++state.explosionCounter),
            x: projectile.x,
            y: projectile.y,
            radius: balance.blastRadius,
            createdAt: now
        });

        for (const target of players) {
            if (target.alive === false || target.spectator) continue;
            const distance = Math.hypot(target.x - projectile.x, target.y - projectile.y);
            if (distance > balance.blastRadius + COMBAT_BALANCE.playerRadius) continue;
            const falloff = Math.min(1, distance / balance.blastRadius);
            let damage = balance.centerDamage -
                (balance.centerDamage - balance.edgeDamage) * falloff;
            if (target.id === projectile.ownerId) damage *= balance.selfDamageMultiplier;
            this.damage(state, target, damage, now, players.find(player => player.id === projectile.ownerId));

            const directionX = target.x - projectile.x;
            const directionY = target.y - projectile.y;
            const directionLength = Math.hypot(directionX, directionY) || 1;
            const strength = Math.max(0, 1 - falloff);
            state.knockback.set(target.id, {
                vx: directionX / directionLength * balance.knockbackSpeed * strength,
                vy: directionY / directionLength * balance.knockbackSpeed * strength,
                endsAt: now + 400
            });
        }
    }

    private applyKnockback(state: Runtime, players: PlayerState[], map: GameMapState, dtMs: number, now: number): void {
        const dt = Math.max(0, dtMs) / 1_000;
        const byId = new Map(players.map(player => [player.id, player]));
        for (const [playerId, force] of state.knockback) {
            const player = byId.get(playerId);
            if (!player || player.alive === false || player.spectator || now >= force.endsAt) {
                state.knockback.delete(playerId);
                continue;
            }
            const nextX = player.x + force.vx * dt;
            const nextY = player.y + force.vy * dt;
            if (!blocked(nextX, player.y, map)) player.x = nextX;
            else force.vx = 0;
            if (!blocked(player.x, nextY, map)) player.y = nextY;
            else force.vy = 0;
            const friction = Math.pow(0.08, dt / 0.4);
            force.vx *= friction;
            force.vy *= friction;
            if (Math.hypot(force.vx, force.vy) < 12) state.knockback.delete(playerId);
        }
    }

    applyEnvironmentalDamage(roomId: string, player: PlayerState, amount: number, now: number): boolean {
        return this.damage(this.runtime(roomId), player, amount, now);
    }

    private damage(
        state: Runtime,
        player: PlayerState,
        amount: number,
        now: number,
        attacker?: PlayerState
    ): boolean {
        if (player.alive === false || player.spectator || player.isDashing || player.isInvulnerable ||
            now < (state.invulnerable.get(player.id) ?? 0)) return false;

        let remainingDamage = Math.max(0, amount);
        const shield = Math.max(0, player.shield ?? 0);
        const absorbed = Math.min(shield, remainingDamage);
        if (absorbed > 0) {
            player.shield = shield - absorbed;
            remainingDamage -= absorbed;
        }
        player.hp = Math.max(0, (player.hp ?? MATCH_BALANCE.initialHealth) - remainingDamage);

        if (player.hp === 0) {
            player.isDashing = false;
            player.immobilizedUntil = 0;
            player.alive = false;
            player.deaths = (player.deaths ?? 0) + 1;
            if (attacker && attacker.id !== player.id) {
                attacker.kills = (attacker.kills ?? 0) + 1;
                const previousHealth = attacker.hp ?? MATCH_BALANCE.initialHealth;
                const maximumHealth = attacker.maxHp ?? MATCH_BALANCE.initialHealth;
                const nextHealth = Math.min(maximumHealth, previousHealth + PICKUP_BALANCE.healOnKill);
                attacker.hp = nextHealth;
                if (nextHealth > previousHealth) {
                    state.heals.push({ playerId: attacker.id, x: attacker.x, y: attacker.y, amount: nextHealth - previousHealth });
                }
            }

            if (state.mode === 'battleRoyale' || (state.mode === 'everyone-vs-one' && player.role === 'titan')) {
                player.spectator = true;
                state.respawn.delete(player.id);
            } else if (state.mode === 'everyone-vs-one' && player.role === 'hunter') {
                player.lives = Math.max(0, (player.lives ?? 1) - 1);
                if (player.lives === 0) {
                    player.spectator = true;
                    state.respawn.delete(player.id);
                } else {
                    state.respawn.set(player.id, now + MATCH_BALANCE.classicRespawnMs);
                }
            } else {
                state.respawn.set(player.id, now + MATCH_BALANCE.classicRespawnMs);
            }
        }
        return true;
    }
}
