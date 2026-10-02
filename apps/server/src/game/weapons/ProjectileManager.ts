import { ProjectileState, WeaponType, ShootPayload } from '@shared/game/weapons';
// Asumiendo que existe una función de hitbox centralizada en el proyecto
import { intersectsHitbox, isWallCollision } from '../collision/collisionMath';

export class ProjectileManager {
  public projectiles: Map<string, ProjectileState> = new Map();
  
  // Configuración base de armamento
  private readonly WEAPON_CONFIG = {
    pistol: { speed: 15, damage: 20, cooldown: 500, spread: 0 },
    machineGun: { speed: 20, damage: 8, cooldown: 100, spread: 0 },
    shotgun: { speed: 18, damage: 15, cooldown: 800, spread: 0.15 } // tres perdigones con direcciones diferentes[cite: 4]
  };

  public handleShootEvent(ownerId: string, payload: ShootPayload) {
    const config = this.WEAPON_CONFIG[payload.weapon];
    
    if (payload.weapon === 'shotgun') {
      // La escopeta genera 3 perdigones por acción[cite: 4]
      this.spawnProjectile(ownerId, payload, payload.angle - config.spread);
      this.spawnProjectile(ownerId, payload, payload.angle);
      this.spawnProjectile(ownerId, payload, payload.angle + config.spread);
    } else {
      // Pistola (semi-automática) y Metralleta (automática) generan un disparo
      this.spawnProjectile(ownerId, payload, payload.angle);
    }
  }

  private spawnProjectile(ownerId: string, payload: ShootPayload, angle: number) {
    const id = Math.random().toString(36).substring(2, 9);
    const speed = this.WEAPON_CONFIG[payload.weapon].speed;
    
    this.projectiles.set(id, {
      id,
      ownerId,
      x: payload.x,
      y: payload.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      weaponType: payload.weapon,
      active: true
    });
  }

  public update(players: Map<string, any>, walls: any[], io: any, roomId: string) {
    for (const [id, proj] of this.projectiles.entries()) {
      proj.x += proj.vx;
      proj.y += proj.vy;

      // 1. Colisión Proyectil-Entorno: Las paredes destruyen las balas
      if (isWallCollision(proj.x, proj.y, walls)) {
        this.projectiles.delete(id);
        io.to(roomId).emit('projectile:destroy', { id });
        continue;
      }

      // 2. Colisión Proyectil-Jugador[cite: 39]
      for (const [playerId, player] of players.entries()) {
        if (playerId === proj.ownerId || player.isInvulnerable) continue;

        if (intersectsHitbox({ x: proj.x, y: proj.y }, player.hitboxConfig)) {
          // Restar vida y destruir el proyectil[cite: 39]
          player.hp -= this.WEAPON_CONFIG[proj.weaponType].damage;
          this.projectiles.delete(id);
          
          io.to(roomId).emit('player:hit', { id: playerId, hp: player.hp });
          io.to(roomId).emit('projectile:destroy', { id });
          break;
        }
      }
    }
  }
}