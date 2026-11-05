import { describe, expect, it } from 'vitest';
import { MATCH_BALANCE, WEAPON_BALANCE } from '@hackatec/shared';
import { availableWeaponSlots, slotForWeapon, weaponForSlot, WEAPON_DEFINITIONS } from './registry.js';

describe('weapon registry', () => {
    it('maps the seven requested slots in the specified order', () => {
        expect([1, 2, 3, 4, 5, 6, 7].map(weaponForSlot)).toEqual([
            'knife', 'machineGun', 'shotgun', 'pistol', 'sniper', 'rocketLauncher', 'laser'
        ]);
        expect(slotForWeapon('pistol')).toBe(4);
    });

    it('rejects invalid slots and hides the exclusive laser from other accounts', () => {
        expect(weaponForSlot(0)).toBeUndefined();
        expect(weaponForSlot(8)).toBeUndefined();
        expect(availableWeaponSlots(false)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(availableWeaponSlots(true)).toContain(7);
    });

    it('restricts Rocket para todos to the rocket launcher loadout', () => {
        expect(availableWeaponSlots(true, 'rockets')).toEqual([6]);
    });

    it('keeps the agreed balance for special weapons and hunters', () => {
        expect(WEAPON_BALANCE.laser.damagePerSecond).toBe(200);
        expect(WEAPON_BALANCE.sniper.damage).toBe(75);
        expect(WEAPON_BALANCE.rocketLauncher.cooldownMs).toBe(1_300);
        expect(WEAPON_BALANCE.rocketLauncher.projectileSpeed).toBe(430);
        expect(MATCH_BALANCE.hunterLives).toBe(3);
    });

    it('defines all seven weapon behaviors', () => {
        expect(Object.keys(WEAPON_DEFINITIONS)).toHaveLength(7);
        expect(WEAPON_DEFINITIONS.machineGun.fireMode).toBe('automatic');
        expect(WEAPON_DEFINITIONS.laser.kind).toBe('beam');
    });
});
