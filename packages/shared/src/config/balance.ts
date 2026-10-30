export const MATCH_BALANCE = {
    minimumPlayers: 2,
    votingDurationMs: 15_000,
    countdownDurationMs: 5_000,
    classicDurationMs: 300_000,
    classicKillLimit: 30,
    initialHealth: 100,
    resultsDurationMs: 15_000,
    classicRespawnMs: 5_000,
    voteRateLimitMs: 250
} as const;

export const WEAPON_SLOT_ORDER = [
    'knife',
    'machineGun',
    'shotgun',
    'pistol',
    'sniper',
    'rocketLauncher',
    'laser'
] as const;

export const WEAPON_BALANCE = {
    knife: { cooldownMs: 450, damage: 28, range: 70, arcRadians: Math.PI / 3 },
    machineGun: { cooldownMs: 100, projectileSpeed: 770, damage: 8, spreadRadians: [0] },
    shotgun: { cooldownMs: 800, projectileSpeed: 590, damagePerPellet: 15, spreadRadians: [-0.15, 0, 0.15] },
    pistol: { cooldownMs: 500, projectileSpeed: 640, damage: 20, spreadRadians: [0] },
    sniper: { cooldownMs: 1_600, damage: 80, range: 1_600 },
    rocketLauncher: {
        cooldownMs: 1_400,
        projectileSpeed: 360,
        centerDamage: 55,
        edgeDamage: 15,
        blastRadius: 110,
        selfDamageMultiplier: 0.5,
        knockbackSpeed: 330,
        lifetimeMs: 5_000
    },
    laser: {
        damagePerSecond: 40,
        tickMs: 100,
        energyMs: 4_000,
        rechargeMs: 3_000,
        range: 1_800
    }
} as const;

export const DASH_BALANCE = {
    distancePx: 170,
    durationMs: 160,
    invulnerabilityMs: 300,
    cooldownMs: 2_500
} as const;

export const PICKUP_BALANCE = {
    maxHealth: 100,
    maxShield: 50,
    medkitHealth: 40,
    shieldAmount: 25,
    healOnKill: 15,
    respawnMs: 60_000,
    battleRoyaleRespawnMs: 120_000
} as const;

export const STORM_BALANCE = {
    phases: 5,
    waitMs: 30_000,
    closeMs: 45_000,
    damagePerSecond: [2, 4, 8, 12, 20],
    minimumRadius: 80
} as const;

export const ZOMBIE_BALANCE = {
    giant: {
        health: 400,
        chargeDamage: 35,
        telegraphMs: 800,
        cooldownMs: 6_000,
        stunnedMs: 2_000,
        moveSpeed: 75,
        chargeSpeed: 420
    },
    spitter: {
        health: 90,
        projectileDamage: 12,
        puddleDamagePerSecond: 6,
        puddleDurationMs: 4_000,
        cooldownMs: 3_000,
        preferredRange: 300,
        fleeRange: 130
    },
    modes: ['classic', 'everyone-vs-one'] as const
} as const;

export const XP_BALANCE = {
    kill: 50,
    assist: 20,
    survivalPerBattleRoyalePhase: 25,
    victory: 150,
    topThree: 75,
    zombieKill: 10,
    baseForNextLevel: 100,
    levelExponent: 1.5
} as const;

export const CHAT_BALANCE = {
    maxLength: 120,
    messageLimit: 5,
    windowMs: 10_000,
    bubbleDurationMs: 4_000,
    historyLimit: 40
} as const;


export const COMBAT_BALANCE = {
    playerRadius: 21,
    projectileRadius: 5,
    damageInvulnerabilityMs: 1_000,
    cactusDamageCooldownMs: 1_000,
    trapDurationMs: 5_000,
    respawnInvulnerabilityMs: 1_000,
    maxProjectileSubstepPx: 8,
    serverTickMs: 50,
    playableTop: 155,
    playableBottom: 715
} as const;
