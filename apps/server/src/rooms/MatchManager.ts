import { MATCH_BALANCE, type GameMode, type MatchStatePayload, type PlayerState } from '@hackatec/shared';

export const AVAILABLE_GAME_MODES: readonly GameMode[] = ['classic'];

type Vote = { playerId: string; mode: GameMode };
type RoomMatch = {
    phase: MatchStatePayload['phase'];
    mode: GameMode | null;
    hostId: string | null;
    players: Set<string>;
    accountIds: Map<string, string>;
    votes: Map<string, Vote>;
    lastVoteAt: Map<string, number>;
    voteEndsAt: number | null;
    startsAt: number | null;
    endsAt: number | null;
    results: MatchStatePayload['results'];
    message?: string;
    blockedByHost: boolean;
};

type MatchTransition = { roomId: string; resetPlayers: boolean };
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
                players: new Set(), accountIds: new Map(), votes: new Map(),
                lastVoteAt: new Map(), voteEndsAt: null, startsAt: null,
                endsAt: null, results: [], blockedByHost: false
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
            if (newPlayerIds.length) match.message = 'Los jugadores que entran durante una partida quedan como espectadores hasta la siguiente ronda.';
        }

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

        if (membershipChanged || hostChanged || newPlayerIds.length) this.markDirty(roomId);

        if (match.phase === 'voting' && match.players.size < MATCH_BALANCE.minimumPlayers) {
            match.phase = 'waiting';
            match.mode = null;
            match.votes.clear();
            match.voteEndsAt = null;
            match.startsAt = null;
            match.endsAt = null;
            match.message = 'Se necesitan al menos 2 jugadores para votar.';
            this.markDirty(roomId);
        }

        if (match.phase === 'waiting' && !match.blockedByHost && match.players.size >= MATCH_BALANCE.minimumPlayers) {
            this.startVoting(roomId, match, now);
        }
    }

    vote(roomId: string, playerId: string, accountId: string, mode: GameMode, now: number): MatchActionResult {
        const match = this.matches.get(roomId);
        if (!match || !match.players.has(playerId)) return { ok: false, message: 'No perteneces a esta sala.' };
        if (match.phase !== 'voting') return { ok: false, message: 'La votación no está abierta.' };
        if (match.voteEndsAt === null || now >= match.voteEndsAt) return { ok: false, message: 'El tiempo de votación terminó.' };
        if (match.accountIds.get(playerId) !== accountId) return { ok: false, message: 'La identidad de la cuenta no es válida.' };
        if (!this.isAvailableMode(mode)) return { ok: false, message: 'Ese modo todavía no está disponible.' };
        if (now - (match.lastVoteAt.get(accountId) ?? -Infinity) < MATCH_BALANCE.voteRateLimitMs) {
            return { ok: false, message: 'Estás votando demasiado rápido. Espera un momento.' };
        }

        match.lastVoteAt.set(accountId, now);
        match.votes.set(accountId, { playerId, mode });
        match.message = 'Voto registrado. Puedes cambiarlo mientras la votación siga abierta.';
        this.markDirty(roomId);
        return { ok: true, message: 'Voto registrado.' };
    }

    forceStart(roomId: string, requesterId: string, mode: GameMode, now: number): MatchActionResult {
        const match = this.matches.get(roomId);
        if (!match || !match.players.has(requesterId)) return { ok: false, message: 'No perteneces a esta sala.' };
        if (match.hostId !== requesterId) return { ok: false, message: 'Solo el anfitrión puede iniciar o reiniciar la partida.' };
        if (!this.isAvailableMode(mode)) return { ok: false, message: 'Ese modo todavía no está disponible.' };

        match.blockedByHost = false;
        this.startCountdown(roomId, match, mode, now, 'El anfitrión inició una nueva partida.');
        return { ok: true, message: 'Nueva partida programada.' };
    }

    stop(roomId: string, requesterId: string): MatchActionResult {
        const match = this.matches.get(roomId);
        if (!match || !match.players.has(requesterId)) return { ok: false, message: 'No perteneces a esta sala.' };
        if (match.hostId !== requesterId) return { ok: false, message: 'Solo el anfitrión puede detener la partida.' };

        match.phase = 'waiting';
        match.mode = null;
        match.votes.clear();
        match.voteEndsAt = null;
        match.startsAt = null;
        match.endsAt = null;
        match.results = [];
        match.blockedByHost = true;
        match.message = 'El anfitrión detuvo la partida. Esperando a que inicie otra.';
        this.markDirty(roomId);
        return { ok: true, message: 'Partida detenida.' };
    }

    advance(now: number, getPlayers: (roomId: string) => PlayerState[]): MatchTransition[] {
        const transitions: MatchTransition[] = [];
        for (const [roomId, match] of this.matches) {
            if (match.phase === 'voting' && match.voteEndsAt !== null && now >= match.voteEndsAt) {
                const mode = this.resolveVote(match.votes);
                this.startCountdown(roomId, match, mode, now, 'Votación finalizada. La partida está por comenzar.');
                transitions.push({ roomId, resetPlayers: true });
                continue;
            }
            if (match.phase === 'countdown' && match.startsAt !== null && now >= match.startsAt) {
                match.phase = 'playing';
                match.startsAt = null;
                match.endsAt = now + this.matchDurationMs;
                match.message = '¡La partida comenzó!';
                this.markDirty(roomId);
                continue;
            }
            if (match.phase === 'playing' && match.endsAt !== null && now >= match.endsAt) {
                match.phase = 'results';
                match.startsAt = null;
                match.results = getPlayers(roomId)
                    .map(player => ({ playerId: player.id, name: player.name,
                        kills: player.kills ?? 0, deaths: player.deaths ?? 0 }))
                    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name));
                match.endsAt = now + this.resultsDurationMs;
                match.message = 'Partida finalizada.';
                this.markDirty(roomId);
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
                match.message = 'Preparando la siguiente ronda.';
                this.markDirty(roomId);
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
        match.message = 'Vota por el modo de la siguiente partida.';
        this.markDirty(roomId);
    }

    private startCountdown(roomId: string, match: RoomMatch, mode: GameMode, now: number, message: string): void {
        match.phase = 'countdown'; match.mode = mode; match.votes.clear();
        match.voteEndsAt = null; match.startsAt = now + this.countdownDurationMs;
        match.endsAt = null; match.results = []; match.message = message;
        this.markDirty(roomId);
    }

    private toPayload(roomId: string, match: RoomMatch): MatchStatePayload {
        const votes: Record<string, GameMode> = {};
        for (const { playerId, mode } of match.votes.values()) votes[playerId] = mode;
        return {
            roomId, phase: match.phase, mode: match.mode, hostId: match.hostId,
            votes, voteEndsAt: match.voteEndsAt, startsAt: match.startsAt,
            endsAt: match.endsAt, results: match.results.map(result => ({ ...result })),
            message: match.message
        };
    }

    private markDirty(roomId: string): void { this.dirtyRooms.add(roomId); }
}
