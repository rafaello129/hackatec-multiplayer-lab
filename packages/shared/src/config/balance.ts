export const MATCH_BALANCE = {
    minimumPlayers: 2,
    votingDurationMs: 15_000,
    countdownDurationMs: 5_000,
    classicDurationMs: 300_000,
    classicKillLimit: 30,
    initialHealth: 100,
    resultsDurationMs: 15_000,
    classicRespawnMs: 4_000,
    voteRateLimitMs: 250,
    everyoneVsOneDurationMs: 270_000,
    titanBaseHealth: 500,
    titanHealthPerHunter: 80,
    hunterLives: 2,
    battleRoyaleDurationMs: 450_000,
    rocketsDurationMs: 300_000,
    zombiesDurationMs: 900_000
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
    sniper: { cooldownMs: 3_000, damage: 95, range: 1_600 },
    rocketLauncher: {
        cooldownMs: 1_600,
        projectileSpeed: 360,
        centerDamage: 50,
        edgeDamage: 15,
        blastRadius: 110,
        selfDamageMultiplier: 0.35,
        knockbackSpeed: 330,
        lifetimeMs: 5_000
    },
    laser: {
        damagePerSecond: 100,
        tickMs: 100,
        energyMs: 4_000,
        rechargeMs: 0,
        range: 1_800
    },
    selectionCooldownMs: 120,
    minimumFireIntentIntervalMs: 35,
    fireIntentTimeoutMs: 220
} as const;

export const DASH_BALANCE = {
    distancePx: 170,
    durationMs: 160,
    invulnerabilityMs: 300,
    cooldownMs: 2_500
} as const;

export const MOVEMENT_BALANCE = {
    speedPxPerSecond: 185,
    inputTimeoutMs: 250
} as const;

export const PICKUP_BALANCE = {
    maxHealth: 100,
    maxShield: 50,
    medkitHealth: 40,
    shieldAmount: 25,
    healOnKill: 15,
    respawnMs: 60_000,
    battleRoyaleRespawnMs: 120_000,
    medkitRespawnMs: 75_000,
    battleRoyaleMedkitRespawnMs: 120_000,
    radiusPx: 15,
    obstaclePaddingPx: 8,
    spawnMarginX: 70,
    spawnMarginY: 48,
    spawnGridX: 82,
    spawnGridY: 74,
    minimumSpacingPx: 150,
    fallbackMinimumSpacingPx: 70,
    fallbackSpawnCount: 32
} as const;

export const STORM_BALANCE = {
    phases: 5,
    waitMs: 25_000,
    closeMs: 40_000,
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
        chargeSpeed: 420,
        chargeRangePx: 220
    },
    spitter: {
        health: 90,
        projectileDamage: 12,
        puddleDamagePerSecond: 6,
        puddleDurationMs: 4_000,
        cooldownMs: 3_000,
        preferredRange: 300,
        fleeRange: 130,
        moveSpeed: 90,
        projectileSpeed: 280,
        projectileLifetimeMs: 1_200,
        projectileRadius: 8,
        puddleRadius: 48
    },
    spawnIntervalMs: 20_000,
    maximumAlive: 24,
    initialSpawnCount: 3,
    totalRounds: 10,
    intermissionMs: 10_000,
    initialLives: 3,
    bossHealth: 2_500,
    bossHealthPerPlayer: 650,
    spawnGridMarginPx: 45,
    spawnGridMinX: 55,
    spawnGridStepX: 60,
    spawnGridStepY: 55,
    spawnRadiusPx: 32,
    highDensityThreshold: 16,
    mediumDensityThreshold: 8,
    highDensityPlayerDistancePx: 75,
    mediumDensityPlayerDistancePx: 130,
    defaultPlayerDistancePx: 190,
    highDensityZombieSeparationPx: 90,
    defaultZombieSeparationPx: 180,
    modes: ['zombies'] as const
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
    cactusDamageCooldownMs: 1_000,
    trapDurationMs: 5_000,
    respawnInvulnerabilityMs: 1_000,
    maxProjectileSubstepPx: 8,
    serverTickMs: 50,
    playableTop: 155,
    playableBottom: 715,
    rayStepPx: 6,
    knockbackStopSpeed: 12
} as const;
