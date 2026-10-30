import { beforeEach, describe, expect, it } from 'vitest';
import type { GameMapState, PlayerState } from '@hackatec/shared';
import { CombatManager } from './CombatManager.js';

const map: GameMapState = {
    seed: 1,
    width: 1_200,
    height: 900,
    obstacles: []
};

function player(id: string, x: number, y = 400): PlayerState {
    return { id, name: id, x, y, hp: 100, maxHp: 100, shield: 0, alive: true, kills: 0, deaths: 0 };
}

describe('CombatManager weapon authority', () => {
    let combat: CombatManager;

    beforeEach(() => {
        combat = new CombatManager();
    });

    it('does not let a regular account select the Gueta-only laser', () => {
        const regular = player('regular', 250);
        combat.initializePlayer('room', regular, false);
        expect(combat.selectWeapon('room', regular, 7, 'classic', 1_000).ok).toBe(false);

        const gueta = player('gueta', 350);
        combat.initializePlayer('room', gueta, true);
        expect(combat.selectWeapon('room', gueta, 7, 'classic', 1_000).ok).toBe(true);
    });

    it('ignores invalid and rate-limited weapon selection', () => {
        const shooter = player('shooter', 250);
        combat.initializePlayer('room', shooter, false);

        expect(combat.selectWeapon('room', shooter, 0, 'classic', 1_000).ok).toBe(false);
        expect(combat.selectWeapon('room', shooter, 2, 'classic', 1_000).ok).toBe(true);
        expect(combat.selectWeapon('room', shooter, 3, 'classic', 1_050).ok).toBe(false);
    });

    it('fires the pistol once per press and does not trust a weapon supplied by the client', () => {
        const shooter = player('shooter', 250);
        combat.initializePlayer('room', shooter, false);

        // Legacy payloads can carry a spoofed weapon property, but the selected server slot wins.
        combat.setFireIntent('room', shooter, { angle: 0, firing: true, weapon: 'rocketLauncher' }, 1_000);
        const first = combat.step('room', [shooter], map, 50, 1_000);
        expect(first.projectiles).toHaveLength(1);
        expect(first.projectiles[0]?.weapon).toBe('pistol');

        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_050);
        const held = combat.step('room', [shooter], map, 50, 1_050);
        expect(held.projectiles).toHaveLength(1);
    });

    it('creates three shotgun pellets and applies their combined damage', () => {
        const shooter = player('shooter', 250);
        const target = player('target', 350);
        combat.initializePlayer('room', shooter, false);
        combat.selectWeapon('room', shooter, 3, 'classic', 1_000);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);

        expect(combat.step('room', [shooter, target], map, 50, 1_000).projectiles).toHaveLength(3);
        combat.step('room', [shooter, target], map, 50, 1_050);
        combat.step('room', [shooter, target], map, 50, 1_100);
        combat.step('room', [shooter, target], map, 50, 1_150);
        combat.step('room', [shooter, target], map, 50, 1_200);
        expect(target.hp).toBe(55);
    });

    it('allows the machine gun to fire automatically while held at its server cooldown', () => {
        const shooter = player('shooter', 250);
        combat.initializePlayer('room', shooter, false);
        combat.selectWeapon('room', shooter, 2, 'classic', 1_000);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);
        expect(combat.step('room', [shooter], map, 50, 1_000).projectiles).toHaveLength(1);

        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_050);
        expect(combat.step('room', [shooter], map, 50, 1_050).projectiles).toHaveLength(1);

        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_100);
        expect(combat.step('room', [shooter], map, 50, 1_100).projectiles).toHaveLength(2);
    });

    it('uses the server hit scan for the sniper and respects its cooldown', () => {
        const shooter = player('shooter', 250);
        const target = player('target', 500);
        combat.initializePlayer('room', shooter, false);
        combat.selectWeapon('room', shooter, 5, 'classic', 1_000);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);
        combat.step('room', [shooter, target], map, 50, 1_000);
        expect(target.hp).toBe(20);

        combat.setFireIntent('room', shooter, { angle: 0, firing: false }, 1_050);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_100);
        combat.step('room', [shooter, target], map, 50, 1_100);
        expect(target.hp).toBe(20);
    });

    it('applies rocket splash damage, reduced self-damage and knockback', () => {
        const shooter = player('shooter', 250);
        const target = player('target', 260);
        combat.initializePlayer('room', shooter, false);
        combat.selectWeapon('room', shooter, 6, 'classic', 1_000);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);
        const snapshot = combat.step('room', [shooter, target], map, 50, 1_000);

        expect(snapshot.explosions).toHaveLength(1);
        expect(target.hp).toBeLessThan(50);
        expect(target.hp).toBeGreaterThan(40);
        expect(shooter.hp).toBeLessThan(100);
        const before = shooter.x;
        combat.step('room', [shooter, target], map, 50, 1_050);
        expect(shooter.x).toBeLessThan(before);
    });

    it('applies continuous laser damage at 40 DPS and exposes the beam state', () => {
        const shooter = player('gueta', 250);
        const target = player('target', 500);
        combat.initializePlayer('room', shooter, true);
        combat.selectWeapon('room', shooter, 7, 'classic', 1_000);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);

        const first = combat.step('room', [shooter, target], map, 50, 1_000);
        const second = combat.step('room', [shooter, target], map, 50, 1_100);
        expect(first.beams).toHaveLength(1);
        expect(second.beams).toHaveLength(1);
        expect(target.hp).toBe(92);
    });

    it('restricts Rocket para todos to slot six on the server tick', () => {
        const shooter = player('shooter', 250);
        combat.initializePlayer('room', shooter, false);
        combat.selectWeapon('room', shooter, 4, 'classic', 1_000);
        const before = combat.getWeaponState('room', shooter.id, 1_000, 'rockets');
        expect(before.availableSlots).toEqual([6]);

        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);
        combat.step('room', [shooter], map, 50, 1_000, 'rockets');
        expect(shooter.selectedWeapon).toBe('rocketLauncher');
    });
});
