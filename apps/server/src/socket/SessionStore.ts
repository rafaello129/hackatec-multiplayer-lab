import { randomBytes } from 'node:crypto';
import { RECONNECTION_WINDOW_MS } from '@hackatec/shared';

export type PlayerSession = {
    token: string;
    playerId: string;
    socketId?: string;
    expiresAt?: number;
};

/** Only server-issued credentials can reclaim a disconnected player. */
export class SessionStore {
    private readonly tokens = new Map<string, PlayerSession>();
    private readonly players = new Map<string, PlayerSession>();

    constructor(readonly windowMs = RECONNECTION_WINDOW_MS) {}

    open(token: unknown, socketId: string, now: number): { session: PlayerSession; recovered: boolean } {
        const prior = typeof token === 'string' ? this.tokens.get(token) : undefined;
        if (prior && !prior.socketId && prior.expiresAt !== undefined && now < prior.expiresAt) {
            prior.socketId = socketId;
            prior.expiresAt = undefined;
            return { session: prior, recovered: true };
        }
        // An active token (e.g. a duplicated tab) gets a new player, never a takeover.
        const session: PlayerSession = { token: randomBytes(32).toString('hex'), playerId: socketId, socketId };
        this.tokens.set(session.token, session);
        this.players.set(session.playerId, session);
        return { session, recovered: false };
    }

    suspend(playerId: string, socketId: string, now: number): boolean {
        const session = this.players.get(playerId);
        if (!session || session.socketId !== socketId) return false;
        session.socketId = undefined;
        session.expiresAt = now + this.windowMs;
        return true;
    }

    remove(playerId: string): void {
        const session = this.players.get(playerId);
        if (session) this.tokens.delete(session.token);
        this.players.delete(playerId);
    }

    expired(now: number): string[] {
        return [...this.players.values()]
            .filter(session => !session.socketId && session.expiresAt !== undefined && now >= session.expiresAt)
            .map(session => session.playerId);
    }
}
