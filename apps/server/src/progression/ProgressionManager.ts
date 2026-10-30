import { XP_BALANCE, type GameMode, type PlayerState } from '@hackatec/shared';

export type ProgressionAward = {
    playerId: string;
    xp: number;
    breakdown: {
        kills: number;
        assists: number;
        zombieKills: number;
        survival: number;
        placement: number;
    };
};

export const ACTIVITY_BALANCE = {
    graceMs: 5_000,
    minimumActiveMs: 30_000,
    minimumRoundRatio: 0.2
} as const;

type ActivityRecord = {
    startedAt: number;
    activeMs: number;
    lastActionAt: number | null;
    lastTickAt: number;
    roundDurationMs: number;
};

export class RoundActivityTracker {
    private readonly rooms = new Map<string, Map<string, ActivityRecord>>();

    start(roomId: string, players: PlayerState[], now: number, roundDurationMs: number): void {
        const records = new Map<string, ActivityRecord>();
        for (const player of players) {
            if (player.spectator) continue;
            records.set(player.id, {
                startedAt: now,
                activeMs: 0,
                lastActionAt: null,
                lastTickAt: now,
                roundDurationMs: Math.max(1, roundDurationMs)
            });
        }
        this.rooms.set(roomId, records);
    }

    mark(roomId: string, playerId: string, now: number): void {
        const record = this.rooms.get(roomId)?.get(playerId);
        if (record) record.lastActionAt = now;
    }

    tick(roomId: string, now: number): void {
        const records = this.rooms.get(roomId);
        if (!records) return;
        for (const record of records.values()) {
            const elapsed = Math.max(0, Math.min(50, now - record.lastTickAt));
            if (record.lastActionAt !== null && now - record.lastActionAt <= ACTIVITY_BALANCE.graceMs) {
                record.activeMs += elapsed;
            }
            record.lastTickAt = now;
        }
    }

    isEligible(roomId: string, playerId: string, now?: number): boolean {
        const record = this.rooms.get(roomId)?.get(playerId);
        if (!record) return false;
        const elapsedRoundMs = Math.max(0, (now ?? record.lastTickAt) - record.startedAt);
        const expectedThreshold = record.roundDurationMs * ACTIVITY_BALANCE.minimumRoundRatio;
        const observedThreshold = elapsedRoundMs * ACTIVITY_BALANCE.minimumRoundRatio;
        const minimum = Math.max(
            ACTIVITY_BALANCE.minimumActiveMs,
            Math.min(expectedThreshold, observedThreshold)
        );
        return record.activeMs >= minimum;
    }

    getActiveMs(roomId: string, playerId: string): number {
        return this.rooms.get(roomId)?.get(playerId)?.activeMs ?? 0;
    }

    removeRoom(roomId: string): void {
        this.rooms.delete(roomId);
    }
}

export function calculateMatchAwards(
    players: PlayerState[],
    placements: Array<{ playerId: string; placement?: number }>,
    mode: GameMode,
    winnerId: string | null
): ProgressionAward[] {
    const placementById = new Map(placements.map(item => [item.playerId, item.placement ?? 0]));
    return players.map(player => {
        const kills = Math.max(0, player.kills ?? 0) * XP_BALANCE.kill;
        const assists = Math.max(0, player.assists ?? 0) * XP_BALANCE.assist;
        const zombieKills = Math.max(0, player.zombieKills ?? 0) * XP_BALANCE.zombieKill;
        const survival = mode === 'battleRoyale'
            ? Math.max(0, player.survivedStormPhases ?? 0) * XP_BALANCE.survivalPerBattleRoyalePhase
            : 0;
        const placement = player.id === winnerId
            ? XP_BALANCE.victory
            : [2, 3].includes(placementById.get(player.id) ?? 0)
                ? XP_BALANCE.topThree
                : 0;
        return {
            playerId: player.id,
            xp: kills + assists + zombieKills + survival + placement,
            breakdown: { kills, assists, zombieKills, survival, placement }
        };
    });
}
