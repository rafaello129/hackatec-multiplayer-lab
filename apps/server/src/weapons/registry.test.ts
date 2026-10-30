import { describe, expect, it } from 'vitest';
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

    it('defines all seven weapon behaviors', () => {
        expect(Object.keys(WEAPON_DEFINITIONS)).toHaveLength(7);
        expect(WEAPON_DEFINITIONS.machineGun.fireMode).toBe('automatic');
        expect(WEAPON_DEFINITIONS.laser.kind).toBe('beam');
    });
});
