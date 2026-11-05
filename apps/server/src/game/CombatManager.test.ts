import { beforeEach, describe, expect, it } from 'vitest';
import { WEAPON_BALANCE } from '@hackatec/shared';
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
    it('keeps machine gun sustained damage at 60 DPS', () => {
        expect(WEAPON_BALANCE.machineGun.damage * 1_000 / WEAPON_BALANCE.machineGun.cooldownMs).toBe(60);
    });

    let combat: CombatManager;

    beforeEach(() => {
        combat = new CombatManager();
    });

    it('enforces the restricted seventh weapon slot', () => {
        const regular = player('regular', 250);
        combat.initializePlayer('room', regular, false);
        expect(combat.selectWeapon('room', regular, 7, 'classic', 1_000).ok).toBe(false);

        const gueta = player('gueta', 350);
        combat.initializePlayer('room', gueta, true);
        expect(combat.selectWeapon('room', gueta, 7, 'classic', 1_000).ok).toBe(true);
    });

    it('omits restricted weapon metadata from regular account state', () => {
        const regular = player('regular', 250);
        combat.initializePlayer('room', regular, false);
        const regularState = combat.getWeaponState('room', regular.id, 1_000, 'classic');
        expect(regularState.availableSlots).not.toContain(7);
        expect(regularState).not.toHaveProperty('laserEnergyMs');
        expect(regularState).not.toHaveProperty('laserEnergyMaxMs');

        const owner = player('gueta', 350);
        combat.initializePlayer('room', owner, true);
        const ownerState = combat.getWeaponState('room', owner.id, 1_000, 'classic');
        expect(ownerState.availableSlots).toContain(7);
        expect(ownerState.laserEnergyMs).toBeDefined();
        expect(ownerState.laserEnergyMaxMs).toBeDefined();
    });

    it('forces the rocket launcher as the selected weapon in Rocket mode', () => {
        const shooter = player('shooter', 250);
        const state = combat.initializePlayer('room', shooter, false, 'rockets');
        expect(state.selectedSlot).toBe(6);
        expect(state.availableSlots).toEqual([6]);
        expect(state.selectedWeapon).toBe('rocketLauncher');
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

    it('blocks sniper rays and projectiles at lakes just like player movement', () => {
        const lakeMap: GameMapState = {
            ...map,
            obstacles: [{ id: 'lake', type: 'lake', x: 330, y: 400, width: 20, height: 100 }]
        };

        const sniper = player('sniper', 250);
        const target = player('target', 500);
        combat.initializePlayer('lake-sniper', sniper, false);
        combat.selectWeapon('lake-sniper', sniper, 5, 'classic', 1_000);
        combat.setFireIntent('lake-sniper', sniper, { angle: 0, firing: true }, 1_000);
        const beam = combat.step('lake-sniper', [sniper, target], lakeMap, 50, 1_000);
        expect(target.hp).toBe(100);
        expect(beam.beams[0]?.x2).toBeLessThan(330);

        const gunner = player('gunner', 250);
        const victim = player('victim', 500);
        combat.initializePlayer('lake-projectile', gunner, false);
        combat.selectWeapon('lake-projectile', gunner, 2, 'classic', 2_000);
        combat.setFireIntent('lake-projectile', gunner, { angle: 0, firing: true }, 2_000);
        combat.step('lake-projectile', [gunner, victim], lakeMap, 50, 2_000);
        combat.step('lake-projectile', [gunner, victim], lakeMap, 50, 2_050);
        const impact = combat.step('lake-projectile', [gunner, victim], lakeMap, 50, 2_100);
        expect(victim.hp).toBe(100);
        expect(impact.projectiles).toHaveLength(0);
    });

    it('deals 75 damage with the sniper and respects its cooldown', () => {
        const shooter = player('shooter', 250);
        const target = player('target', 500);
        combat.initializePlayer('room', shooter, false);
        combat.selectWeapon('room', shooter, 5, 'classic', 1_000);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);
        const shot = combat.step('room', [shooter, target], map, 50, 1_000);
        expect(target.hp).toBe(25);
        expect(shot.beams).toMatchObject([{ ownerId: 'shooter', x1: 250, y1: 400, x2: 484, y2: 400, weapon: 'sniper' }]);

        combat.setFireIntent('room', shooter, { angle: 0, firing: false }, 1_050);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_100);
        combat.step('room', [shooter, target], map, 50, 1_100);
        expect(target.hp).toBe(25);
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
        expect(target.hp).toBeLessThan(55);
        expect(target.hp).toBeGreaterThan(40);
        expect(shooter.hp).toBeLessThan(100);
        const before = shooter.x;
        combat.step('room', [shooter, target], map, 50, 1_050);
        expect(shooter.x).toBeLessThan(before);
    });

    it('applies continuous laser damage at 200 DPS and exposes the beam state', () => {
        const shooter = player('gueta', 250);
        const target = player('target', 500);
        combat.initializePlayer('room', shooter, true);
        combat.selectWeapon('room', shooter, 7, 'classic', 1_000);
        combat.setFireIntent('room', shooter, { angle: 0, firing: true }, 1_000);

        const first = combat.step('room', [shooter, target], map, 50, 1_000);
        const second = combat.step('room', [shooter, target], map, 50, 1_100);
        expect(first.beams).toHaveLength(1);
        expect(second.beams).toHaveLength(1);
        expect(target.hp).toBe(60);
    });

    it('restores laser energy instantly when recharge is configured as zero seconds', () => {
        const shooter = player('gueta', 250);
        combat.initializePlayer('laser-recharge', shooter, true);
        combat.selectWeapon('laser-recharge', shooter, 7, 'classic', 1_000);

        for (let now = 1_000; now <= 4_900; now += 50) {
            combat.setFireIntent('laser-recharge', shooter, { angle: 0, firing: true }, now);
            combat.step('laser-recharge', [shooter], map, 50, now);
        }
        expect(combat.getWeaponState('laser-recharge', shooter.id, 4_900, 'classic').laserEnergyMs).toBe(0);

        combat.setFireIntent('laser-recharge', shooter, { angle: 0, firing: false }, 4_950);
        combat.step('laser-recharge', [shooter], map, 0, 4_950);
        expect(combat.getWeaponState('laser-recharge', shooter.id, 4_950, 'classic').laserEnergyMs).toBe(4_000);
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

    it('keeps players allied in Zombies mode across hitscan, melee and rocket splash', () => {
        const sniper = player('sniper', 250);
        const sniperAlly = player('sniper-ally', 350);
        combat.initializePlayer('zombie-sniper', sniper, false, 'zombies');
        combat.selectWeapon('zombie-sniper', sniper, 5, 'zombies', 1_000);
        combat.setFireIntent('zombie-sniper', sniper, { angle: 0, firing: true }, 1_000);
        combat.step('zombie-sniper', [sniper, sniperAlly], map, 50, 1_000, 'zombies');
        expect(sniperAlly.hp).toBe(100);

        const knifeUser = player('knife-user', 250);
        const knifeAlly = player('knife-ally', 280);
        combat.initializePlayer('zombie-knife', knifeUser, false, 'zombies');
        combat.selectWeapon('zombie-knife', knifeUser, 1, 'zombies', 1_000);
        combat.setFireIntent('zombie-knife', knifeUser, { angle: 0, firing: true }, 1_000);
        combat.step('zombie-knife', [knifeUser, knifeAlly], map, 50, 1_000, 'zombies');
        expect(knifeAlly.hp).toBe(100);

        const rocketUser = player('rocket-user', 250);
        const rocketAlly = player('rocket-ally', 300);
        const rockMap: GameMapState = {
            ...map,
            obstacles: [{ id: 'test-rock', type: 'rock', x: 300, y: 400, width: 20, height: 40 }]
        };
        combat.initializePlayer('zombie-rocket', rocketUser, false, 'zombies');
        combat.selectWeapon('zombie-rocket', rocketUser, 6, 'zombies', 1_000);
        combat.setFireIntent('zombie-rocket', rocketUser, { angle: 0, firing: true }, 1_000);
        combat.step('zombie-rocket', [rocketUser, rocketAlly], rockMap, 50, 1_000, 'zombies');
        const impact = combat.step('zombie-rocket', [rocketUser, rocketAlly], rockMap, 50, 1_050, 'zombies');
        expect(impact.explosions).toHaveLength(1);
        expect(rocketAlly.hp).toBe(100);
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
        expect(laser.zombieHits[0]?.damage).toBe(20);
    });

    it('blocks shots with rocks but lets projectiles pass through lakes', () => {
        const fireThrough = (type: 'rock' | 'lake'): number => {
            const manager = new CombatManager();
            const shooter = player('shooter', 250);
            const target = player('target', 420);
            const terrain: GameMapState = {
                ...map,
                obstacles: [{ id: type, type, x: 330, y: 400, width: 70, height: 90 }]
            };
            manager.initializePlayer('terrain-room', shooter, false);
            manager.setFireIntent('terrain-room', shooter, { angle: 0, firing: true }, 1_000);
            for (let now = 1_000; now <= 1_300; now += 50) {
                manager.step('terrain-room', [shooter, target], terrain, 50, now, 'classic');
            }
            return target.hp ?? 0;
        };

        expect(fireThrough('rock')).toBe(100);
        expect(fireThrough('lake')).toBe(80);
    });

    it('decrements zombie lives and eliminates a player after the third death', () => {
        const survivor = player('survivor', 250);
        survivor.lives = 3;
        combat.initializePlayer('zombie-room', survivor, false, 'zombies');
        combat.step('zombie-room', [survivor], map, 50, 0, 'zombies');

        survivor.hp = 1;
        combat.applyEnvironmentalDamage('zombie-room', survivor, 1, 100);
        expect(survivor.lives).toBe(2);
        combat.step('zombie-room', [survivor], map, 50, 4_100, 'zombies');
        survivor.isInvulnerable = false;
        survivor.hp = 1;
        combat.applyEnvironmentalDamage('zombie-room', survivor, 1, 5_200);
        expect(survivor.lives).toBe(1);
        combat.step('zombie-room', [survivor], map, 50, 9_200, 'zombies');
        survivor.isInvulnerable = false;
        survivor.hp = 1;
        combat.applyEnvironmentalDamage('zombie-room', survivor, 1, 10_300);
        expect(survivor.lives).toBe(0);
        expect(survivor.spectator).toBe(true);
    });

    it('gives the Titan a damaging dash shockwave with a cooldown', () => {
        const titan = player('titan', 250);
        titan.role = 'titan';
        titan.isDashing = true;
        const hunter = player('hunter', 340);
        hunter.role = 'hunter';
        combat.initializePlayer('titan-room', titan, false, 'everyone-vs-one');
        combat.step('titan-room', [titan, hunter], map, 50, 1_000, 'everyone-vs-one');
        expect(hunter.hp).toBe(65);
        combat.step('titan-room', [titan, hunter], map, 50, 1_050, 'everyone-vs-one');
        expect(hunter.hp).toBe(65);
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
