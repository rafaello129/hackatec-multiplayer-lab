import {
    COMBAT_BALANCE,
    MATCH_BALANCE,
    ZOMBIE_BALANCE,
    WEAPON_BALANCE,
    WEAPON_TEXTS,
    PICKUP_BALANCE,
    type ExplosionState,
    type GameMapState,
    type LaserBeamState,
    type KillFeedEntry,
    type PlayerState,
    type ProjectileState,
    type ProjectileWeaponType,
    type PlayerTrappedPayload,
    type PlayerHealedPayload,
    type WeaponFirePayload,
    type WeaponSlot,
    type WeaponStatePayload,
    type WeaponType,
    type ZombieState,
    type ZombieHitPayload
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
    playersById: Map<string, PlayerState>;
    damageContributions: Map<string, Map<string, number>>;
    killFeed: KillFeedEntry[];
};

export type CombatStepResult = {
    projectiles: ProjectileState[];
    beams: LaserBeamState[];
    explosions: ExplosionState[];
    trapped: PlayerTrappedPayload[];
    heals: PlayerHealedPayload[];
    zombieHits: ZombieHitPayload[];
    killFeed: KillFeedEntry[];
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
        ['wall', 'rock', 'lake'].includes(obstacle.type) && overlaps(x, y, radius, obstacle)
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
                mode: null,
                playersById: new Map(),
                damageContributions: new Map(),
                killFeed: []
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
        if (mode === 'rockets') weapon.selectedSlot = 6;
        else if (!canUseLaser && weapon.selectedSlot === 7) weapon.selectedSlot = 4;
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
        state.playersById.clear();
        state.damageContributions.clear();
        state.killFeed = [];
    }

    revivePlayer(roomId: string, player: PlayerState, now: number): void {
        const state = this.runtime(roomId);
        state.respawn.delete(player.id);
        state.traps.delete(player.id);
        state.invulnerable.set(player.id, now + COMBAT_BALANCE.respawnInvulnerabilityMs);
        player.alive = true;
        player.spectator = false;
        player.hp = player.maxHp ?? MATCH_BALANCE.initialHealth;
        player.shield = 0;
        player.isInvulnerable = true;
        player.immobilizedUntil = 0;
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
        state.playersById.delete(playerId);
        state.damageContributions.delete(playerId);
        for (const contributions of state.damageContributions.values()) contributions.delete(playerId);
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
        if (now - weapon.lastSelectionAt < WEAPON_BALANCE.selectionCooldownMs) {
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
        if (request.firing && now - weapon.lastIntentAt < WEAPON_BALANCE.minimumFireIntentIntervalMs) return;

        weapon.angle = request.angle;
        weapon.lastIntentAt = now;
        if (request.firing && !weapon.firing) weapon.justPressed = true;
        weapon.firing = request.firing;
    }

    getWeaponState(roomId: string, playerId: string, now: number, mode: string | null = null): WeaponStatePayload {
        const state = this.runtime(roomId);
        const weapon = this.weaponRuntime(state, playerId);
        const canUseLaser = state.laserOwners.has(playerId);
        const selectedWeapon = canUseLaser
            ? weaponForSlot(weapon.selectedSlot) ?? 'pistol'
            : weapon.selectedSlot === 7 ? 'pistol' : weaponForSlot(weapon.selectedSlot) ?? 'pistol';
        return {
            selectedSlot: canUseLaser ? weapon.selectedSlot : Math.min(weapon.selectedSlot, 6) as WeaponSlot,
            selectedWeapon,
            availableSlots: availableWeaponSlots(canUseLaser, mode),
            cooldownRemainingMs: Math.max(0, weapon.cooldownUntil - now),
            ...(canUseLaser ? {
                laserEnergyMs: Math.floor(weapon.laserEnergyMs),
                laserEnergyMaxMs: WEAPON_BALANCE.laser.energyMs
            } : {})
        };
    }

    step(
        roomId: string,
        players: PlayerState[],
        map: GameMapState,
        dtMs: number,
        now: number,
        mode: string | null = 'classic',
        zombies: ZombieState[] = []
    ): CombatStepResult {
        const state = this.runtime(roomId);
        state.mode = mode;
        const dt = Math.min(Math.max(dtMs, 0), COMBAT_BALANCE.serverTickMs);
        const explosions: ExplosionState[] = [];
        const beams: LaserBeamState[] = [];
        const trapped: PlayerTrappedPayload[] = [];
        const zombieHits: ZombieHitPayload[] = [];
        state.heals = [];
        state.killFeed = [];
        const byId = new Map(players.map(player => [player.id, player]));
        state.playersById = byId;
        const playerRadius = COMBAT_BALANCE.playerRadius;
        const projectileRadius = COMBAT_BALANCE.projectileRadius;

        this.applyKnockback(state, byId, map, dt, now);

        for (const player of players) {
            if (player.spectator) continue;
            if (player.alive === false) {
                const respawnAt = state.respawn.get(player.id) ?? Number.POSITIVE_INFINITY;
                if (now >= respawnAt) {
                    const candidates = Array.from({ length: 32 }, (_, index) => getSpawnPosition(index));
                    const spawn = candidates.find(point =>
                        !map.obstacles.some(obstacle => ['wall', 'rock', 'lake'].includes(obstacle.type) && overlaps(point.x, point.y, playerRadius, obstacle)) &&
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
                if (['wall', 'rock', 'lake'].includes(obstacle.type) || !overlaps(player.x, player.y, playerRadius, obstacle)) continue;
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
            this.processWeapon(state, roomId, player, players, map, dt, now, mode, beams, zombies, zombieHits);
        }

        this.stepProjectiles(state, roomId, players, map, dt, now, explosions, byId, zombies, zombieHits);

        return {
            projectiles: [...state.projectiles.values()],
            beams,
            explosions,
            trapped,
            heals: [...state.heals],
            zombieHits,
            killFeed: [...state.killFeed]
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
        beams: LaserBeamState[],
        zombies: ZombieState[],
        zombieHits: ZombieHitPayload[]
    ): void {
        const weaponState = this.weaponRuntime(state, player.id);
        if (weaponState.firing && now - weaponState.lastIntentAt > WEAPON_BALANCE.fireIntentTimeoutMs) weaponState.firing = false;

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
            const trace = this.traceRay(player, weaponState.angle, WEAPON_BALANCE.laser.range, players, map, zombies);
            beams.push({ ownerId: player.id, x1: player.x, y1: player.y, x2: trace.x, y2: trace.y, weapon: 'laser' });
            const laserDamage = WEAPON_BALANCE.laser.damagePerSecond * energyUsed / 1_000;
            if (trace.target) this.damage(state, trace.target, laserDamage, now, player);
            else if (trace.zombie) zombieHits.push({ zombieId: trace.zombie.id, attackerId: player.id, damage: laserDamage });
            weaponState.laserEnergyMs = Math.max(0, weaponState.laserEnergyMs - energyUsed);
            weaponState.cooldownUntil = now + WEAPON_BALANCE.laser.tickMs;
            if (weaponState.laserEnergyMs <= 0) weaponState.firing = false;
            return;
        }

        weaponState.cooldownUntil = now + definition.cooldownMs;
        switch (weapon) {
            case 'knife':
                this.fireKnife(state, player, players, zombies, zombieHits, now, weaponState.angle);
                break;
            case 'sniper': {
                const trace = this.traceRay(player, weaponState.angle, WEAPON_BALANCE.sniper.range, players, map, zombies);
                beams.push({ ownerId: player.id, x1: player.x, y1: player.y, x2: trace.x, y2: trace.y, weapon: 'sniper' });
                if (trace.target) this.damage(state, trace.target, WEAPON_BALANCE.sniper.damage, now, player);
                else if (trace.zombie) zombieHits.push({ zombieId: trace.zombie.id, attackerId: player.id, damage: WEAPON_BALANCE.sniper.damage });
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
        zombies: ZombieState[],
        zombieHits: ZombieHitPayload[],
        now: number,
        angle: number
    ): void {
        let nearest: PlayerState | undefined;
        let nearestZombie: ZombieState | undefined;
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
                nearestZombie = undefined;
                nearestDistance = distance;
            }
        }
        for (const zombie of zombies) {
            if (!zombie.alive) continue;
            const dx = zombie.x - attacker.x;
            const dy = zombie.y - attacker.y;
            const distance = Math.hypot(dx, dy);
            if (distance > WEAPON_BALANCE.knife.range + zombie.radius) continue;
            const offset = Math.abs(normalizeAngle(Math.atan2(dy, dx) - angle));
            if (offset <= WEAPON_BALANCE.knife.arcRadians && distance < nearestDistance) {
                nearest = undefined;
                nearestZombie = zombie;
                nearestDistance = distance;
            }
        }
        if (nearest) this.damage(state, nearest, WEAPON_BALANCE.knife.damage, now, attacker);
        else if (nearestZombie) zombieHits.push({
            zombieId: nearestZombie.id, attackerId: attacker.id, damage: WEAPON_BALANCE.knife.damage
        });
    }

    private traceRay(
        attacker: PlayerState,
        angle: number,
        range: number,
        players: PlayerState[],
        map: GameMapState,
        zombies: ZombieState[] = []
    ): { x: number; y: number; target?: PlayerState; zombie?: ZombieState } {
        const step = COMBAT_BALANCE.rayStepPx;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        for (let distance = step; distance <= range; distance += step) {
            const x = attacker.x + dx * distance;
            const y = attacker.y + dy * distance;
            if (x < 0 || x > map.width || y < COMBAT_BALANCE.playableTop || y > COMBAT_BALANCE.playableBottom ||
                map.obstacles.some(obstacle => ['wall', 'rock'].includes(obstacle.type) && overlaps(x, y, 1, obstacle))) {
                return { x, y };
            }
            const target = players.find(player =>
                player.id !== attacker.id && player.alive !== false && !player.spectator &&
                Math.hypot(player.x - x, player.y - y) <= COMBAT_BALANCE.playerRadius
            );
            if (target) return { x, y, target };
            const zombie = zombies.find(candidate => candidate.alive &&
                Math.hypot(candidate.x - x, candidate.y - y) <= candidate.radius);
            if (zombie) return { x, y, zombie };
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
        byId: Map<string, PlayerState>,
        zombies: ZombieState[],
        zombieHits: ZombieHitPayload[]
    ): void {
        const dt = Math.min(Math.max(dtMs, 0), COMBAT_BALANCE.serverTickMs) / 1_000;
        for (const [id, projectile] of state.projectiles) {
            const speedDistance = Math.hypot(projectile.vx * dt, projectile.vy * dt);
            const segments = Math.max(1, Math.ceil(speedDistance / COMBAT_BALANCE.maxProjectileSubstepPx));
            let hit = false;
            let impactTarget: PlayerState | undefined;
            let impactZombie: ZombieState | undefined;

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
                    map.obstacles.some(obstacle => ['wall', 'rock'].includes(obstacle.type) &&
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
                if (!impactTarget) {
                    impactZombie = zombies.find(target => target.alive &&
                        Math.hypot(target.x - projectile.x, target.y - projectile.y) <=
                            target.radius + COMBAT_BALANCE.projectileRadius);
                    if (impactZombie) hit = true;
                }
            }

            if (hit) {
                if (projectile.weapon === 'rocketLauncher') {
                    this.explode(state, roomId, projectile, players, now, explosions, zombies, zombieHits);
                } else if (impactTarget) {
                    const damage = projectile.weapon === 'machineGun'
                        ? WEAPON_BALANCE.machineGun.damage
                        : projectile.weapon === 'shotgun'
                            ? WEAPON_BALANCE.shotgun.damagePerPellet
                            : WEAPON_BALANCE.pistol.damage;
                    this.damage(state, impactTarget, damage, now, byId.get(projectile.ownerId));
                } else if (impactZombie) {
                    const damage = projectile.weapon === 'machineGun'
                        ? WEAPON_BALANCE.machineGun.damage
                        : projectile.weapon === 'shotgun'
                            ? WEAPON_BALANCE.shotgun.damagePerPellet
                            : WEAPON_BALANCE.pistol.damage;
                    zombieHits.push({ zombieId: impactZombie.id, attackerId: projectile.ownerId, damage });
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
        explosions: ExplosionState[],
        zombies: ZombieState[],
        zombieHits: ZombieHitPayload[]
    ): void {
        const balance = WEAPON_BALANCE.rocketLauncher;
        const attacker = players.find(player => player.id === projectile.ownerId);
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
            this.damage(state, target, damage, now, attacker);

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
        for (const zombie of zombies) {
            if (!zombie.alive) continue;
            const distance = Math.hypot(zombie.x - projectile.x, zombie.y - projectile.y);
            if (distance > balance.blastRadius + zombie.radius) continue;
            const falloff = Math.min(1, distance / balance.blastRadius);
            const damage = balance.centerDamage - (balance.centerDamage - balance.edgeDamage) * falloff;
            zombieHits.push({ zombieId: zombie.id, attackerId: projectile.ownerId, damage });
        }
    }

    private applyKnockback(state: Runtime, byId: Map<string, PlayerState>, map: GameMapState, dtMs: number, now: number): void {
        const dt = Math.max(0, dtMs) / 1_000;
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
            if (Math.hypot(force.vx, force.vy) < COMBAT_BALANCE.knockbackStopSpeed) state.knockback.delete(playerId);
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
        if (attacker && attacker.id !== player.id && amount > 0) {
            const contributions = state.damageContributions.get(player.id) ?? new Map<string, number>();
            contributions.set(attacker.id, (contributions.get(attacker.id) ?? 0) + amount);
            state.damageContributions.set(player.id, contributions);
        }

        if (player.hp === 0) {
            player.isDashing = false;
            player.immobilizedUntil = 0;
            player.alive = false;
            player.deaths = (player.deaths ?? 0) + 1;
            const contributions = state.damageContributions.get(player.id);
            if (attacker && attacker.id !== player.id) {
                attacker.kills = (attacker.kills ?? 0) + 1;
                state.killFeed.push({
                    id: state.killFeed.length + ':' + now,
                    killerId: attacker.id,
                    killerName: attacker.name,
                    victimId: player.id,
                    victimName: player.name,
                    createdAt: now
                });
                for (const [contributorId, totalDamage] of contributions ?? []) {
                    if (contributorId === attacker.id || totalDamage <= 0) continue;
                    const assister = state.playersById.get(contributorId);
                    if (assister) assister.assists = (assister.assists ?? 0) + 1;
                }
                const previousHealth = attacker.hp ?? MATCH_BALANCE.initialHealth;
                const maximumHealth = attacker.maxHp ?? MATCH_BALANCE.initialHealth;
                const nextHealth = Math.min(maximumHealth, previousHealth + PICKUP_BALANCE.healOnKill);
                attacker.hp = nextHealth;
                if (nextHealth > previousHealth) {
                    state.heals.push({ playerId: attacker.id, x: attacker.x, y: attacker.y, amount: nextHealth - previousHealth });
                }
            }

            state.damageContributions.delete(player.id);
            if (state.mode === 'zombies') {
                player.lives = Math.max(0, (player.lives ?? ZOMBIE_BALANCE.initialLives) - 1);
                if (player.lives === 0) {
                    player.spectator = true;
                    state.respawn.delete(player.id);
                } else {
                    state.respawn.set(player.id, now + MATCH_BALANCE.classicRespawnMs);
                }
            } else if (state.mode === 'battleRoyale' || (state.mode === 'everyone-vs-one' && player.role === 'titan')) {
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
