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
