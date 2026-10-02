import { Scene, Input, Math as PhaserMath } from 'phaser';
import { WeaponType } from '@shared/game/weapons';
import { socket } from '../../network/socket';

export class WeaponController {
  private scene: Scene;
  private currentWeapon: WeaponType = 'pistol';
  private lastShotTime: number = 0;
  
  private readonly COOLDOWNS = {
    pistol: 500,
    machineGun: 100, // Disparo continuo rápido[cite: 4, 39]
    shotgun: 800
  };

  constructor(scene: Scene) {
    this.scene = scene;
    this.setupWeaponSwitching();
  }

  private setupWeaponSwitching() {
    // Alternar armas[cite: 39]
    this.scene.input.keyboard.on('keydown-ONE', () => this.currentWeapon = 'pistol');
    this.scene.input.keyboard.on('keydown-TWO', () => this.currentWeapon = 'machineGun');
    this.scene.input.keyboard.on('keydown-THREE', () => this.currentWeapon = 'shotgun');
  }

  public update(playerX: number, playerY: number, pointer: Input.Pointer) {
    if (!pointer.isDown) return; // Disparo con el mouse[cite: 39]

    const time = this.scene.time.now;
    if (time - this.lastShotTime >= this.COOLDOWNS[this.currentWeapon]) {
      
      // Validación cliente: la pistola/escopeta requieren clics nuevos, la metralleta permite ráfagas manteniendo presionado[cite: 39]
      if (this.currentWeapon !== 'machineGun' && !pointer.justDown) {
        return; 
      }

      const angle = PhaserMath.Angle.Between(playerX, playerY, pointer.worldX, pointer.worldY);

      // Petición de disparo al servidor[cite: 38]
      socket.emit('player:shoot', {
        x: playerX,
        y: playerY,
        angle: angle,
        weapon: this.currentWeapon
      });

      this.lastShotTime = time;
    }
  }
}