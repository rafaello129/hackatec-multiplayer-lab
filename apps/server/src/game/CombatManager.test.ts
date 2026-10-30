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

    it('credits an assist to a player who damaged the victim before the final hit', () => {
        const firstAttacker = player('first', 250, 380);
        const finalAttacker = player('final', 250, 420);
        const victim = player('victim', 300, 400);
        victim.hp = 40;
        combat.initializePlayer('room', firstAttacker, false);
        combat.initializePlayer('room', finalAttacker, false);

        combat.setFireIntent('room', firstAttacker, { angle: 0, firing: true }, 1_000);
        combat.step('room', [firstAttacker, finalAttacker, victim], map, 50, 1_000);
        combat.step('room', [firstAttacker, finalAttacker, victim], map, 50, 1_050);
        expect(victim.hp).toBe(20);

        combat.setFireIntent('room', firstAttacker, { angle: 0, firing: false }, 1_100);
        combat.setFireIntent('room', finalAttacker, { angle: Math.atan2(-20, 50), firing: true }, 2_000);
        combat.step('room', [firstAttacker, finalAttacker, victim], map, 50, 2_000);
        combat.step('room', [firstAttacker, finalAttacker, victim], map, 50, 2_050);

        expect(victim.alive).toBe(false);
        expect(finalAttacker.kills).toBe(1);
        expect(firstAttacker.assists).toBe(1);
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

    it('permanently eliminates Battle Royale players instead of scheduling respawn', () => {
        const shooter = player('shooter', 250);
        const victim = player('victim', 280);
        victim.hp = 10;
        victim.role = 'survivor';
        victim.lives = 1;
        combat.initializePlayer('room', shooter, false);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);
        combat.step('room', [shooter, victim], map, 50, 1_000, 'battleRoyale');

        expect(victim.alive).toBe(false);
        expect(victim.spectator).toBe(true);
        combat.step('room', [shooter, victim], map, 50, 20_000, 'battleRoyale');
        expect(victim.alive).toBe(false);
        expect(victim.spectator).toBe(true);
    });

    it('removes a Titan without respawn and decrements hunter lives on death', () => {
        const hunter = player('hunter', 250);
        const titan = player('titan', 280);
        titan.hp = 10;
        titan.role = 'titan';
        hunter.role = 'hunter';
        hunter.lives = 2;
        combat.initializePlayer('room', hunter, false);
        combat.setFireIntent('room', hunter, { angle: 0, firing: true }, 1_000);
        combat.step('room', [hunter, titan], map, 50, 1_000, 'everyone-vs-one');

        expect(titan.alive).toBe(false);
        expect(titan.spectator).toBe(true);

        const hunterVictim = player('hunter-victim', 280);
        hunterVictim.role = 'hunter';
        hunterVictim.lives = 2;
        hunterVictim.hp = 10;
        const titanShooter = player('titan-shooter', 250);
        combat.initializePlayer('room-hunter', titanShooter, false);
        combat.setFireIntent('room-hunter', titanShooter, { angle: 0, firing: true }, 2_000);
        combat.step('room-hunter', [titanShooter, hunterVictim], map, 50, 2_000, 'everyone-vs-one');
        expect(hunterVictim.lives).toBe(1);
        expect(hunterVictim.spectator).not.toBe(true);
    });

    it('allows projectile, melee and laser weapons to damage zombie targets', () => {
        const shooter = player('shooter', 250);
        const zombie = {
            id: 'zombie', type: 'giant' as const, x: 280, y: 400,
            hp: 400, maxHp: 400, radius: 29, alive: true,
            phase: 'approach' as const, phaseEndsAt: 0, targetId: null, angle: 0
        };
        combat.initializePlayer('room', shooter, false);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);
        const projectile = combat.step('room', [shooter], map, 50, 1_000, 'classic', [zombie]);
        expect(projectile.zombieHits[0]).toMatchObject({
            zombieId: 'zombie',
            attackerId: 'shooter',
            damage: 20
        });

        const knifeUser = player('knife-user', 250);
        const nearbyZombie = { ...zombie, id: 'knife-target', hp: 400, x: 300 };
        combat.initializePlayer('knife-room', knifeUser, false);
        combat.selectWeapon('knife-room', knifeUser, 1, 'classic', 1_000);
        combat.setFireIntent('knife-room', knifeUser, { angle: 0, firing: true }, 1_000);
        const knife = combat.step('knife-room', [knifeUser], map, 50, 1_000, 'classic', [nearbyZombie]);
        expect(knife.zombieHits[0]?.damage).toBe(28);

        const laserUser = player('gueta', 250);
        const laserTarget = { ...zombie, id: 'laser-target', hp: 400 };
        combat.initializePlayer('laser-room', laserUser, true);
        combat.selectWeapon('laser-room', laserUser, 7, 'classic', 1_000);
        combat.setFireIntent('laser-room', laserUser, { angle: 0, firing: true }, 1_000);
        const laser = combat.step('laser-room', [laserUser], map, 50, 1_000, 'classic', [laserTarget]);
        expect(laser.zombieHits[0]?.damage).toBe(4);
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
