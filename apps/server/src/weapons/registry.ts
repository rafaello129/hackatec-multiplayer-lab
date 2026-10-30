import {
    WEAPON_BALANCE,
    WEAPON_SLOT_ORDER
} from '@hackatec/shared';
import type { WeaponSlot, WeaponType } from '@hackatec/shared';

export type WeaponFireMode = 'semi' | 'automatic' | 'beam';
export type WeaponKind = 'melee' | 'projectile' | 'hitscan' | 'beam';

export type WeaponDefinition = {
    slot: WeaponSlot;
    type: WeaponType;
    kind: WeaponKind;
    fireMode: WeaponFireMode;
    cooldownMs: number;
};

export const WEAPON_DEFINITIONS: Record<WeaponType, WeaponDefinition> = {
    knife: { slot: 1, type: 'knife', kind: 'melee', fireMode: 'semi', cooldownMs: WEAPON_BALANCE.knife.cooldownMs },
    machineGun: { slot: 2, type: 'machineGun', kind: 'projectile', fireMode: 'automatic', cooldownMs: WEAPON_BALANCE.machineGun.cooldownMs },
    shotgun: { slot: 3, type: 'shotgun', kind: 'projectile', fireMode: 'semi', cooldownMs: WEAPON_BALANCE.shotgun.cooldownMs },
    pistol: { slot: 4, type: 'pistol', kind: 'projectile', fireMode: 'semi', cooldownMs: WEAPON_BALANCE.pistol.cooldownMs },
    sniper: { slot: 5, type: 'sniper', kind: 'hitscan', fireMode: 'semi', cooldownMs: WEAPON_BALANCE.sniper.cooldownMs },
    rocketLauncher: { slot: 6, type: 'rocketLauncher', kind: 'projectile', fireMode: 'semi', cooldownMs: WEAPON_BALANCE.rocketLauncher.cooldownMs },
    laser: { slot: 7, type: 'laser', kind: 'beam', fireMode: 'beam', cooldownMs: WEAPON_BALANCE.laser.tickMs }
};

export function weaponForSlot(slot: number): WeaponType | undefined {
    if (!Number.isInteger(slot) || slot < 1 || slot > WEAPON_SLOT_ORDER.length) return undefined;
    return WEAPON_SLOT_ORDER[slot - 1];
}

export function slotForWeapon(weapon: WeaponType): WeaponSlot {
    return (WEAPON_SLOT_ORDER.indexOf(weapon) + 1) as WeaponSlot;
}

export function availableWeaponSlots(canUseLaser: boolean, mode: string | null = null): WeaponSlot[] {
    if (mode === 'rockets') return [6];
    return canUseLaser ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];
}
