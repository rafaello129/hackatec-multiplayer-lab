import type { GameMapState, PlayerState, ProjectileState, ShootPayload, WeaponType } from '@hackatec/shared';
import { getSpawnPosition } from './spawn.js';

const WEAPONS: Record<WeaponType, { cooldown: number; speed: number; damage: number; spread: number[] }> = {
    pistol: { cooldown: 500, speed: 640, damage: 20, spread: [0] },
    machineGun: { cooldown: 100, speed: 770, damage: 8, spread: [0] },
    shotgun: { cooldown: 800, speed: 590, damage: 15, spread: [-0.15, 0, 0.15] }
};
const PROJECTILE_RADIUS = 5, PLAYER_RADIUS = 21;
const overlaps = (x: number, y: number, radius: number, o: { x: number; y: number; width: number; height: number }) => {
    const dx = Math.max(Math.abs(x - o.x) - o.width / 2, 0);
    const dy = Math.max(Math.abs(y - o.y) - o.height / 2, 0);
    return dx * dx + dy * dy < radius * radius;
};
type Runtime = { projectiles: Map<string, ProjectileState>; cooldowns: Map<string, number>; invulnerable: Map<string, number>; cactus: Map<string, number>; respawn: Map<string, number>; projectileCounter: number };
export class CombatManager {
    private readonly rooms = new Map<string, Runtime>();
    private runtime(roomId: string): Runtime {
        let state = this.rooms.get(roomId);
        if (!state) {
            state = { projectiles: new Map(), cooldowns: new Map(), invulnerable: new Map(), cactus: new Map(), respawn: new Map(), projectileCounter: 0 };
            this.rooms.set(roomId, state);
        }
        return state;
    }
    leave(roomId: string, playerId: string, roomEmpty: boolean): void {
        if (roomEmpty) { this.rooms.delete(roomId); return; }
        const s = this.rooms.get(roomId);
        if (!s) return;
        s.cooldowns.delete(playerId); s.invulnerable.delete(playerId); s.cactus.delete(playerId); s.respawn.delete(playerId);
        for (const [id, p] of s.projectiles) if (p.ownerId === playerId) s.projectiles.delete(id);
    }
    shoot(roomId: string, player: PlayerState, payload: unknown, now: number): void {
        if (player.alive === false || !payload || typeof payload !== 'object') return;
        const request = payload as Partial<ShootPayload>;
        if (request.weapon !== 'pistol' && request.weapon !== 'machineGun' && request.weapon !== 'shotgun') return;
        if (typeof request.angle !== 'number' || !Number.isFinite(request.angle)) return;
        const config = WEAPONS[request.weapon], s = this.runtime(roomId);
        const key = player.id;
        if (now < (s.cooldowns.get(key) ?? 0)) return;
        s.cooldowns.set(key, now + config.cooldown);
        for (const offset of config.spread) {
            const angle = request.angle + offset;
            const id = roomId + ':' + (++s.projectileCounter);
            s.projectiles.set(id, { id, ownerId: player.id, x: player.x, y: player.y, vx: Math.cos(angle) * config.speed, vy: Math.sin(angle) * config.speed, weapon: request.weapon });
        }
    }
    private damage(roomId: string, player: PlayerState, amount: number, now: number, attacker?: PlayerState): void {
        const s = this.runtime(roomId);
        if (player.alive === false || player.isDashing || now < (s.invulnerable.get(player.id) ?? 0)) return;
        player.hp = Math.max(0, (player.hp ?? 100) - amount);
        s.invulnerable.set(player.id, now + 1000);
        if (player.hp === 0) {
            player.alive = false;
            player.deaths = (player.deaths ?? 0) + 1;
            if (attacker && attacker.id !== player.id) attacker.kills = (attacker.kills ?? 0) + 1;
            s.respawn.set(player.id, now + 3000);
        }
    }
    step(roomId: string, players: PlayerState[], map: GameMapState, dtMs: number, now: number): ProjectileState[] {
        const s = this.runtime(roomId);
        const byId = new Map(players.map(p => [p.id, p]));
        for (const player of players) {
            if (player.alive === false) {
                if (now >= (s.respawn.get(player.id) ?? Infinity)) {
                    const spawn = getSpawnPosition(players.findIndex(p => p.id === player.id));
                    player.x = spawn.x; player.y = spawn.y;
                    player.hp = 100; player.alive = true; player.immobilizedUntil = 0;
                    s.invulnerable.set(player.id, now + 1000);
                    s.respawn.delete(player.id);
                }
                continue;
            }
            for (const obstacle of map.obstacles) {
                if (obstacle.type === 'wall' || !overlaps(player.x, player.y, PLAYER_RADIUS, obstacle)) continue;
                if (obstacle.type === 'trap' && !player.isDashing && (player.immobilizedUntil ?? 0) <= now) player.immobilizedUntil = now + 5000;
                if (obstacle.type === 'cactus' && now >= (s.cactus.get(player.id) ?? 0)) {
                    this.damage(roomId, player, obstacle.damage, now);
                    s.cactus.set(player.id, now + 1000);
                }
            }
        }
        const dt = Math.min(Math.max(dtMs, 0), 50) / 1000;
        for (const [id, p] of s.projectiles) {
            const previousX = p.x, previousY = p.y;
            const length = Math.hypot(p.vx * dt, p.vy * dt);
            const segments = Math.max(1, Math.ceil(length / 8));
            let hit = false;
            for (let i = 0; i < segments && !hit; i++) {
                p.x += p.vx * dt / segments; p.y += p.vy * dt / segments;
                if (p.x < 0 || p.x > map.width || p.y < 155 || p.y > 715 ||
                    map.obstacles.some(o => o.type === 'wall' && overlaps(p.x, p.y, PROJECTILE_RADIUS, o))) { hit = true; break; }
                for (const target of players) {
                    if (target.id === p.ownerId || target.alive === false) continue;
                    if (Math.hypot(target.x - p.x, target.y - p.y) <= PLAYER_RADIUS + PROJECTILE_RADIUS) {
                        this.damage(roomId, target, WEAPONS[p.weapon].damage, now, byId.get(p.ownerId));
                        hit = true; break;
                    }
                }
            }
            if (hit || (p.x === previousX && p.y === previousY)) s.projectiles.delete(id);
        }
        return [...s.projectiles.values()];
    }
}
