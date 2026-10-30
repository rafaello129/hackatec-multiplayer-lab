import type { GameMode, MatchStatePayload, PlayerState } from '@hackatec/shared';

export const AVAILABLE_GAME_MODES: readonly GameMode[] = ['classic'];

type RoomMatch = {
    phase: MatchStatePayload['phase'];
    mode: GameMode | null;
    hostId: string | null;
    players: Set<string>;
    votes: Map<string, GameMode>;
    voteEndsAt: number | null;
    startsAt: number | null;
    endsAt: number | null;
    results: MatchStatePayload['results'];
    message?: string;
    blockedByHost: boolean;
};

type MatchTransition = {
    roomId: string;
    resetPlayers: boolean;
};

export type MatchActionResult = {
    ok: boolean;
    message: string;
};

export class MatchManager {
    private readonly matches = new Map<string, RoomMatch>();
    private readonly dirtyRooms = new Set<string>();

    constructor(
        private readonly voteDurationMs = 15_000,
        private readonly countdownDurationMs = 5_000,
        private readonly matchDurationMs = 300_000,
        private readonly resultsDurationMs = 10_000
    ) {}

    syncRoom(roomId: string, players: PlayerState[], hostId: string | undefined, now: number): void {
        if (players.length === 0) {
            this.matches.delete(roomId);
            this.dirtyRooms.delete(roomId);
            return;
        }

        let match = this.matches.get(roomId);
        if (!match) {
            match = {
                phase: 'waiting',
                mode: null,
                hostId: hostId ?? null,
                players: new Set(),
                votes: new Map(),
                voteEndsAt: null,
                startsAt: null,
                endsAt: null,
                results: [],
                blockedByHost: false
            };
            this.matches.set(roomId, match);
        }

        const nextPlayers = new Set(players.map(player => player.id));
        const membershipChanged = nextPlayers.size !== match.players.size ||
            [...nextPlayers].some(id => !match.players.has(id));
        const hostChanged = match.hostId !== (hostId ?? null);

        match.players = nextPlayers;
        match.hostId = hostId ?? null;

        for (const voterId of match.votes.keys()) {
            if (!nextPlayers.has(voterId)) match.votes.delete(voterId);
        }

        if (membershipChanged || hostChanged) this.markDirty(roomId);

        if (match.phase === 'voting' && match.players.size < 2) {
            match.phase = 'waiting';
            match.mode = null;
            match.votes.clear();
            match.voteEndsAt = null;
            match.startsAt = null;
            match.endsAt = null;
            match.message = 'Se necesitan al menos 2 jugadores para votar.';
            this.markDirty(roomId);
        }

        if (match.phase === 'waiting' && !match.blockedByHost && match.players.size >= 2) {
            this.startVoting(roomId, match, now);
        }
    }

    vote(roomId: string, playerId: string, mode: GameMode, now: number): MatchActionResult {
        const match = this.matches.get(roomId);
        if (!match || !match.players.has(playerId)) return { ok: false, message: 'No perteneces a esta sala.' };
        if (match.phase !== 'voting') return { ok: false, message: 'La votación no está abierta.' };
        if (match.voteEndsAt === null || now >= match.voteEndsAt) return { ok: false, message: 'El tiempo de votación terminó.' };
        if (!this.isAvailableMode(mode)) return { ok: false, message: 'Ese modo todavía no está disponible.' };

        match.votes.set(playerId, mode);
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
                    .map(player => ({
                        playerId: player.id,
                        name: player.name,
                        kills: player.kills ?? 0,
                        deaths: player.deaths ?? 0
                    }))
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
                if (!match.blockedByHost && match.players.size >= 2) this.startVoting(roomId, match, now);
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

    isPlaying(roomId: string): boolean {
        return this.matches.get(roomId)?.phase === 'playing';
    }

    private isAvailableMode(mode: GameMode): boolean {
        return AVAILABLE_GAME_MODES.includes(mode);
    }

    private resolveVote(votes: Map<string, GameMode>): GameMode {
        const counts = new Map<GameMode, number>();
        for (const mode of votes.values()) counts.set(mode, (counts.get(mode) ?? 0) + 1);
        let winner: GameMode = 'classic';
        let highest = -1;
        for (const mode of AVAILABLE_GAME_MODES) {
            const count = counts.get(mode) ?? 0;
            if (count > highest) {
                winner = mode;
                highest = count;
            }
        }
        return winner;
    }

    private startVoting(roomId: string, match: RoomMatch, now: number): void {
        match.phase = 'voting';
        match.mode = null;
        match.votes.clear();
        match.voteEndsAt = now + this.voteDurationMs;
        match.startsAt = null;
        match.endsAt = null;
        match.results = [];
        match.message = 'Vota por el modo de la siguiente partida.';
        this.markDirty(roomId);
    }

    private startCountdown(roomId: string, match: RoomMatch, mode: GameMode, now: number, message: string): void {
        match.phase = 'countdown';
        match.mode = mode;
        match.votes.clear();
        match.voteEndsAt = null;
        match.startsAt = now + this.countdownDurationMs;
        match.endsAt = null;
        match.results = [];
        match.message = message;
        this.markDirty(roomId);
    }

    private toPayload(roomId: string, match: RoomMatch): MatchStatePayload {
        return {
            roomId,
            phase: match.phase,
            mode: match.mode,
            hostId: match.hostId,
            votes: Object.fromEntries(match.votes),
            voteEndsAt: match.voteEndsAt,
            startsAt: match.startsAt,
            endsAt: match.endsAt,
            results: match.results.map(result => ({ ...result })),
            message: match.message
        };
    }

    private markDirty(roomId: string): void {
        this.dirtyRooms.add(roomId);
    }
}
