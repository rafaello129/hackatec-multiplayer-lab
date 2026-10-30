import { MATCH_BALANCE, MATCH_TEXTS, type GameMode, type MatchStatePayload, type PlayerState, type ZombieStatePayload } from '@hackatec/shared';

export const AVAILABLE_GAME_MODES: readonly GameMode[] = ['classic', 'everyone-vs-one', 'rockets', 'battleRoyale', 'zombies'];

type Vote = { playerId: string; mode: GameMode };
type RoomMatch = {
    phase: MatchStatePayload['phase'];
    mode: GameMode | null;
    hostId: string | null;
    players: Set<string>;
    alivePlayerIds: string[];
    accountIds: Map<string, string>;
    votes: Map<string, Vote>;
    lastVoteAt: Map<string, number>;
    voteEndsAt: number | null;
    startsAt: number | null;
    endsAt: number | null;
    results: MatchStatePayload['results'];
    winnerId: string | null;
    winnerName: string | null;
    message?: string;
    blockedByHost: boolean;
};

type MatchTransition = { roomId: string; resetPlayers: boolean; previousPhase: MatchStatePayload['phase']; phase: MatchStatePayload['phase'] };
export type MatchActionResult = { ok: boolean; message: string };

export class MatchManager {
    private readonly matches = new Map<string, RoomMatch>();
    private readonly dirtyRooms = new Set<string>();

    constructor(
        private readonly voteDurationMs: number = MATCH_BALANCE.votingDurationMs,
        private readonly countdownDurationMs: number = MATCH_BALANCE.countdownDurationMs,
        private readonly matchDurationMs: number = MATCH_BALANCE.classicDurationMs,
        private readonly resultsDurationMs: number = MATCH_BALANCE.resultsDurationMs,
        private readonly availableModes: readonly GameMode[] = AVAILABLE_GAME_MODES
    ) {}

    syncRoom(roomId: string, players: PlayerState[], hostId: string | undefined, now: number,
        accountIds: Map<string, string> = new Map(players.map(player => [player.id, player.id]))): void {
        if (players.length === 0) {
            this.matches.delete(roomId);
            this.dirtyRooms.delete(roomId);
            return;
        }

        let match = this.matches.get(roomId);
        if (!match) {
            match = {
                phase: 'waiting', mode: null, hostId: hostId ?? null,
                players: new Set(), alivePlayerIds: [], accountIds: new Map(), votes: new Map(),
                lastVoteAt: new Map(), voteEndsAt: null, startsAt: null,
                endsAt: null, results: [], winnerId: null, winnerName: null, blockedByHost: false
            };
            this.matches.set(roomId, match);
        }

        const nextPlayers = new Set(players.map(player => player.id));
        const membershipChanged = nextPlayers.size !== match.players.size ||
            [...nextPlayers].some(id => !match.players.has(id));
        const hostChanged = match.hostId !== (hostId ?? null);
        const newPlayerIds = [...nextPlayers].filter(id => !match.players.has(id));

        match.players = nextPlayers;
        match.hostId = hostId ?? null;
        match.accountIds = new Map(accountIds);

        if (['countdown', 'playing', 'results'].includes(match.phase)) {
            for (const player of players) {
                if (newPlayerIds.includes(player.id)) player.spectator = true;
            }
            if (newPlayerIds.length) match.message = MATCH_TEXTS.messages.lateJoin;
        }

        // Rebuild this after late joiners are marked as spectators.
        const nextAlivePlayerIds = players
            .filter(player => player.alive !== false && !player.spectator)
            .map(player => player.id);
        const aliveChanged = nextAlivePlayerIds.length !== match.alivePlayerIds.length ||
            nextAlivePlayerIds.some((id, index) => id !== match!.alivePlayerIds[index]);
        match.alivePlayerIds = nextAlivePlayerIds;

        for (const [accountId, vote] of match.votes) {
            if (!nextPlayers.has(vote.playerId)) {
                const replacement = [...nextPlayers].find(id => match!.accountIds.get(id) === accountId);
                if (replacement) vote.playerId = replacement;
                else match.votes.delete(accountId);
            }
        }
        for (const accountId of match.lastVoteAt.keys()) {
            if (![...match.accountIds.values()].includes(accountId)) match.lastVoteAt.delete(accountId);
        }

        if (membershipChanged || hostChanged || newPlayerIds.length || aliveChanged) this.markDirty(roomId);

        if (match.phase === 'voting' && match.players.size < MATCH_BALANCE.minimumPlayers) {
            match.phase = 'waiting';
            match.mode = null;
            match.votes.clear();
            match.voteEndsAt = null;
            match.startsAt = null;
            match.endsAt = null;
            match.message = MATCH_TEXTS.messages.needPlayers;
            this.markDirty(roomId);
        }

        if (match.phase === 'waiting' && !match.blockedByHost && match.players.size >= MATCH_BALANCE.minimumPlayers) {
            this.startVoting(roomId, match, now);
        }
    }

    vote(roomId: string, playerId: string, accountId: string, mode: GameMode, now: number): MatchActionResult {
        const match = this.matches.get(roomId);
        if (!match || !match.players.has(playerId)) return { ok: false, message: MATCH_TEXTS.errors.notMember };
        if (match.phase !== 'voting') return { ok: false, message: MATCH_TEXTS.errors.voteClosed };
        if (match.voteEndsAt === null || now >= match.voteEndsAt) return { ok: false, message: MATCH_TEXTS.errors.voteExpired };
        if (match.accountIds.get(playerId) !== accountId) return { ok: false, message: MATCH_TEXTS.errors.identityInvalid };
        if (!this.isAvailableMode(mode)) return { ok: false, message: MATCH_TEXTS.errors.modeUnavailable };
        if (now - (match.lastVoteAt.get(accountId) ?? -Infinity) < MATCH_BALANCE.voteRateLimitMs) {
            return { ok: false, message: MATCH_TEXTS.errors.voteRateLimit };
        }

        match.lastVoteAt.set(accountId, now);
        match.votes.set(accountId, { playerId, mode });
        match.message = MATCH_TEXTS.messages.voteRecorded;
        this.markDirty(roomId);
        return { ok: true, message: 'Voto registrado.' };
    }

    forceStart(roomId: string, requesterId: string, mode: GameMode, now: number): MatchActionResult {
        const match = this.matches.get(roomId);
        if (!match || !match.players.has(requesterId)) return { ok: false, message: MATCH_TEXTS.errors.notMember };
        if (match.hostId !== requesterId) return { ok: false, message: MATCH_TEXTS.errors.hostOnlyStart };
        if (!this.isAvailableMode(mode)) return { ok: false, message: MATCH_TEXTS.errors.modeUnavailable };

        match.blockedByHost = false;
        this.startCountdown(roomId, match, mode, now, MATCH_TEXTS.messages.hostStarted);
        return { ok: true, message: 'Nueva partida programada.' };
    }

    stop(roomId: string, requesterId: string): MatchActionResult {
        const match = this.matches.get(roomId);
        if (!match || !match.players.has(requesterId)) return { ok: false, message: MATCH_TEXTS.errors.notMember };
        if (match.hostId !== requesterId) return { ok: false, message: MATCH_TEXTS.errors.hostOnlyStop };

        match.phase = 'waiting';
        match.mode = null;
        match.votes.clear();
        match.voteEndsAt = null;
        match.startsAt = null;
        match.endsAt = null;
        match.results = [];
        match.winnerId = null;
        match.winnerName = null;
        match.blockedByHost = true;
        match.message = MATCH_TEXTS.messages.hostStopped;
        this.markDirty(roomId);
        return { ok: true, message: 'Partida detenida.' };
    }

    advance(now: number, getPlayers: (roomId: string) => PlayerState[], getZombieState?: (roomId: string) => ZombieStatePayload): MatchTransition[] {
        const transitions: MatchTransition[] = [];
        for (const [roomId, match] of this.matches) {
            if (match.phase === 'voting' && match.voteEndsAt !== null && now >= match.voteEndsAt) {
                const mode = this.resolveVote(match.votes);
                this.startCountdown(roomId, match, mode, now, MATCH_TEXTS.messages.voteFinished);
                transitions.push({ roomId, resetPlayers: true, previousPhase: 'voting', phase: 'countdown' });
                continue;
            }
            if (match.phase === 'countdown' && match.startsAt !== null && now >= match.startsAt) {
                match.phase = 'playing';
                match.startsAt = null;
                match.endsAt = match.mode === 'zombies' ? null : now + this.durationForMode(match.mode);
                match.message = MATCH_TEXTS.messages.gameStarted;
                this.markDirty(roomId);
                transitions.push({ roomId, resetPlayers: false, previousPhase: 'countdown', phase: 'playing' });
                continue;
            }
            if (match.phase === 'playing' && (match.endsAt !== null || match.mode === 'zombies')) {
                const roundPlayers = getPlayers(roomId);
                const outcome = this.resolveModeOutcome(match.mode, roundPlayers, match.endsAt !== null && now >= match.endsAt, getZombieState?.(roomId));
                if (!outcome.finished) continue;
                match.phase = 'results';
                match.startsAt = null;
                const ordered = this.orderModeResults(match.mode, roundPlayers, outcome.winnerId);
                match.results = ordered.map((player, index) => ({
                    playerId: player.id,
                    name: player.name,
                    kills: player.kills ?? 0,
                    deaths: player.deaths ?? 0,
                    assists: player.assists ?? 0,
                    zombieKills: player.zombieKills ?? 0,
                    survivedStormPhases: player.survivedStormPhases ?? 0,
                    placement: index + 1
                }));
                match.winnerId = outcome.winnerId;
                match.winnerName = roundPlayers.find(player => player.id === outcome.winnerId)?.name ?? null;
                match.endsAt = now + this.resultsDurationMs;
                match.message = outcome.message;
                this.markDirty(roomId);
                transitions.push({ roomId, resetPlayers: false, previousPhase: 'playing', phase: 'results' });
                continue;
            }
            if (match.phase === 'results' && match.endsAt !== null && now >= match.endsAt) {
                match.phase = 'waiting';
                match.mode = null;
                match.votes.clear();
                match.voteEndsAt = null;
                match.startsAt = null;
                match.endsAt = null;
                match.results = [];
                match.winnerId = null;
                match.winnerName = null;
                match.message = MATCH_TEXTS.messages.nextRound;
                this.markDirty(roomId);
                transitions.push({ roomId, resetPlayers: false, previousPhase: 'results', phase: 'waiting' });
                if (!match.blockedByHost && match.players.size >= MATCH_BALANCE.minimumPlayers) this.startVoting(roomId, match, now);
            }
        }
        return transitions;
    }

    takeUpdates(): MatchStatePayload[] {
        const updates: MatchStatePayload[] = [];
        for (const roomId of this.dirtyRooms) {
            const match = this.matches.get(roomId);
            if (match) updates.push(this.toPayload(roomId, match));
        }
        this.dirtyRooms.clear();
        return updates;
    }

    getState(roomId: string): MatchStatePayload | undefined {
        const match = this.matches.get(roomId);
        return match ? this.toPayload(roomId, match) : undefined;
    }

    isPlaying(roomId: string): boolean { return this.matches.get(roomId)?.phase === 'playing'; }

    private durationForMode(mode: GameMode | null): number {
        switch (mode) {
            case 'everyone-vs-one': return MATCH_BALANCE.everyoneVsOneDurationMs;
            case 'rockets': return MATCH_BALANCE.rocketsDurationMs;
            case 'battleRoyale': return MATCH_BALANCE.battleRoyaleDurationMs;
            case 'zombies': return MATCH_BALANCE.zombiesDurationMs;
            case 'classic':
            default: return this.matchDurationMs;
        }
    }

    private resolveModeOutcome(
        mode: GameMode | null,
        players: PlayerState[],
        timeExpired: boolean,
        zombieState?: ZombieStatePayload
    ): { finished: boolean; winnerId: string | null; message: string } {
        if (mode === 'zombies') {
            const phase = zombieState?.runPhase;
            if (phase !== 'won' && phase !== 'lost') return { finished: false, winnerId: null, message: '' };
            const winner = [...players].sort((a, b) =>
                (b.zombieKills ?? 0) - (a.zombieKills ?? 0) || a.name.localeCompare(b.name)
            )[0];
            return {
                finished: true,
                winnerId: phase === 'won' ? winner?.id ?? null : null,
                message: phase === 'won' ? '¡El equipo derrotó al jefe zombi!' : 'La horda acabó con todo el equipo.'
            };
        }

        if (mode === 'battleRoyale') {
            const survivors = players.filter(player => player.alive !== false && !player.spectator);
            if (survivors.length <= 1) {
                return {
                    finished: true,
                    winnerId: survivors[0]?.id ?? null,
                    message: survivors.length ? '¡Tenemos un ganador de Battle Royale!' : 'Todos los participantes fueron eliminados.'
                };
            }
            if (timeExpired) {
                const ranked = [...survivors].sort((a, b) =>
                    (b.hp ?? 0) - (a.hp ?? 0) ||
                    (b.kills ?? 0) - (a.kills ?? 0) ||
                    a.deaths! - b.deaths!
                );
                return { finished: true, winnerId: ranked[0]?.id ?? null, message: 'Tiempo agotado. Resultado por supervivencia y salud restante.' };
            }
            return { finished: false, winnerId: null, message: '' };
        }

        if (mode === 'everyone-vs-one') {
            const titan = players.find(player => player.role === 'titan');
            // The Titan is not replaced if they disconnect; this round is cancelled.
            if (!titan) return { finished: true, winnerId: null, message: 'El Titan se desconectó. Ronda cancelada.' };
            const hunters = players.filter(player => player.role === 'hunter');
            // A hunter who is waiting for their remaining life to respawn still keeps the team alive.
            const activeHunters = hunters.filter(player =>
                !player.spectator && (player.lives ?? 0) > 0
            );
            if (titan.alive === false || (titan.hp ?? 0) <= 0) {
                const winner = [...activeHunters].sort((a, b) =>
                    (b.kills ?? 0) - (a.kills ?? 0) || a.name.localeCompare(b.name)
                )[0];
                return { finished: true, winnerId: winner?.id ?? null, message: '¡Los cazadores derrotaron al Titan!' };
            }
            if (activeHunters.length === 0 || timeExpired) {
                return {
                    finished: true,
                    winnerId: titan.id,
                    message: timeExpired ? '¡El Titan resistió hasta el final!' : '¡El Titan eliminó a todos los cazadores!'
                };
            }
            return { finished: false, winnerId: null, message: '' };
        }

        const participants = players.filter(player => !player.spectator);
        const killLimitReached = mode === 'classic' &&
            participants.some(player => (player.kills ?? 0) >= MATCH_BALANCE.classicKillLimit);
        if (!timeExpired && !killLimitReached) return { finished: false, winnerId: null, message: '' };
        const winner = [...participants].sort((a, b) =>
            (b.kills ?? 0) - (a.kills ?? 0) ||
            (a.deaths ?? 0) - (b.deaths ?? 0) ||
            a.name.localeCompare(b.name)
        )[0];
        return {
            finished: true,
            winnerId: winner?.id ?? null,
            message: winner ? MATCH_TEXTS.messages.gameFinished : 'No quedan participantes activos.'
        };
    }

    private orderModeResults(mode: GameMode | null, players: PlayerState[], winnerId: string | null): PlayerState[] {
        const sorted = [...players];
        if (mode === 'battleRoyale') {
            return sorted.sort((a, b) => {
                if (a.id === winnerId) return -1;
                if (b.id === winnerId) return 1;
                const aAlive = a.alive !== false && !a.spectator;
                const bAlive = b.alive !== false && !b.spectator;
                return Number(bAlive) - Number(aAlive) ||
                    (b.hp ?? 0) - (a.hp ?? 0) ||
                    (b.kills ?? 0) - (a.kills ?? 0);
            });
        }
        if (mode === 'everyone-vs-one') {
            return sorted.sort((a, b) => {
                if (a.id === winnerId) return -1;
                if (b.id === winnerId) return 1;
                if (a.role === 'titan' && b.role !== 'titan') return -1;
                if (b.role === 'titan' && a.role !== 'titan') return 1;
                return (b.kills ?? 0) - (a.kills ?? 0) || a.name.localeCompare(b.name);
            });
        }
        return sorted.sort((a, b) =>
            Number(Boolean(a.spectator)) - Number(Boolean(b.spectator)) ||
            (b.kills ?? 0) - (a.kills ?? 0) ||
            (a.deaths ?? 0) - (b.deaths ?? 0) ||
            a.name.localeCompare(b.name)
        );
    }

    private isAvailableMode(mode: GameMode): boolean { return this.availableModes.includes(mode); }

    private resolveVote(votes: Map<string, Vote>): GameMode {
        const counts = new Map<GameMode, number>();
        for (const { mode } of votes.values()) counts.set(mode, (counts.get(mode) ?? 0) + 1);
        if (counts.size === 0) return this.pickRandom(this.availableModes);
        const highest = Math.max(...counts.values());
        const tied = [...counts.entries()].filter(([, count]) => count === highest).map(([mode]) => mode);
        return this.pickRandom(tied);
    }

    private pickRandom(modes: readonly GameMode[]): GameMode {
        return modes[Math.min(modes.length - 1, Math.floor(Math.random() * modes.length))] ?? 'classic';
    }

    private startVoting(roomId: string, match: RoomMatch, now: number): void {
        match.phase = 'voting'; match.mode = null; match.votes.clear();
        match.voteEndsAt = now + this.voteDurationMs;
        match.startsAt = null; match.endsAt = null; match.results = [];
        match.message = MATCH_TEXTS.messages.votePrompt;
        this.markDirty(roomId);
    }

    private startCountdown(roomId: string, match: RoomMatch, mode: GameMode, now: number, message: string): void {
        match.phase = 'countdown'; match.mode = mode; match.votes.clear();
        match.voteEndsAt = null; match.startsAt = now + this.countdownDurationMs;
        match.endsAt = null; match.results = []; match.winnerId = null; match.winnerName = null; match.message = message;
        this.markDirty(roomId);
    }

    private toPayload(roomId: string, match: RoomMatch): MatchStatePayload {
        const votes: Record<string, GameMode> = {};
        for (const { playerId, mode } of match.votes.values()) votes[playerId] = mode;
        return {
            roomId, phase: match.phase, mode: match.mode, hostId: match.hostId,
            votes, alivePlayerIds: [...match.alivePlayerIds], voteEndsAt: match.voteEndsAt, startsAt: match.startsAt,
            endsAt: match.endsAt, results: match.results.map(result => ({ ...result })),
            winnerId: match.winnerId, winnerName: match.winnerName,
            message: match.message
        };
    }

    private markDirty(roomId: string): void { this.dirtyRooms.add(roomId); }
}
