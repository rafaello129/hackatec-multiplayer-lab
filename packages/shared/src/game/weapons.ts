export type WeaponType = 'pistol' | 'machineGun' | 'shotgun';

export interface ProjectileState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weaponType: WeaponType;
  active: boolean;
}

export interface PlayerWeaponState {
  hp: number;
  maxHp: number;
  currentWeapon: WeaponType;
  isImmobilized: boolean; // Para las trampas
  isInvulnerable: boolean; // Para el dash/Shift y cactus i-frames
}

export interface ShootPayload {
  x: number;
  y: number;
  angle: number;
  weapon: WeaponType;
}