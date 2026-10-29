import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { PlayerAppearance } from '@hackatec/shared';

export type Account = {
    id: string;
    username: string;
    appearance: PlayerAppearance;
};

type AccountRow = {
    id: string;
    username: string;
    password_hash: string;
};

type ProfileRow = {
    appearance_json: string;
};

const DEFAULT_APPEARANCE: PlayerAppearance = { mode: 'color', colorHex: '#60A5FA' };
export const SESSION_COOKIE = 'hackatec_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeUsername(username: string): string {
    return username.toLocaleLowerCase('en-US');
}

export function hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export class AccountStore {
    private readonly db: DatabaseSync;

    constructor(databasePath = process.env.DB_PATH || path.resolve('storage/accounts.sqlite')) {
        mkdirSync(path.dirname(databasePath), { recursive: true });
        this.db = new DatabaseSync(databasePath);
        this.db.exec('PRAGMA foreign_keys = ON;');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                username_key TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS profiles (
                user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
                appearance_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
            CREATE TABLE IF NOT EXISTS progression (
                user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
                xp INTEGER NOT NULL DEFAULT 0,
                level INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS skins (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
        `);
    }

    createAccount(username: string, passwordHash: string): Account {
        const id = randomBytes(16).toString('hex');
        const now = Date.now();
        const usernameKey = normalizeUsername(username);
        this.db.exec('BEGIN IMMEDIATE');
        try {
            this.db.prepare(
                'INSERT INTO accounts (id, username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
            ).run(id, username, usernameKey, passwordHash, now);
            this.db.prepare(
                'INSERT INTO profiles (user_id, appearance_json) VALUES (?, ?)'
            ).run(id, JSON.stringify(DEFAULT_APPEARANCE));
            this.db.prepare(
                'INSERT INTO progression (user_id, xp, level) VALUES (?, 0, 1)'
            ).run(id);
            this.db.exec('COMMIT');
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
        return { id, username, appearance: { ...DEFAULT_APPEARANCE } };
    }

    findAccountByUsername(username: string): (AccountRow & { username_key: string }) | undefined {
        return this.db.prepare(
            'SELECT id, username, username_key, password_hash FROM accounts WHERE username_key = ?'
        ).get(normalizeUsername(username)) as (AccountRow & { username_key: string }) | undefined;
    }

    getAccountById(id: string): Account | undefined {
        const row = this.db.prepare(
            'SELECT a.id, a.username, p.appearance_json FROM accounts a JOIN profiles p ON p.user_id = a.id WHERE a.id = ?'
        ).get(id) as ({ id: string; username: string; appearance_json: string } | undefined);
        if (!row) return undefined;
        return { id: row.id, username: row.username, appearance: this.parseAppearance(row.appearance_json) };
    }

    createSession(userId: string): string {
        const token = randomBytes(32).toString('base64url');
        const now = Date.now();
        this.db.prepare(
            'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
        ).run(hashSessionToken(token), userId, now + SESSION_TTL_MS, now);
        this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
        return token;
    }

    getAccountBySessionToken(token: string | undefined): Account | undefined {
        if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return undefined;
        const now = Date.now();
        const row = this.db.prepare(
            'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?'
        ).get(hashSessionToken(token), now) as ({ user_id: string } | undefined);
        if (!row) return undefined;
        return this.getAccountById(row.user_id);
    }

    revokeSession(token: string | undefined): void {
        if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return;
        this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
    }

    updateAppearance(userId: string, appearance: PlayerAppearance): Account | undefined {
        this.db.prepare('UPDATE profiles SET appearance_json = ? WHERE user_id = ?')
            .run(JSON.stringify(appearance), userId);
        return this.getAccountById(userId);
    }

    close(): void {
        this.db.close();
    }

    private parseAppearance(value: string): PlayerAppearance {
        try {
            const parsed = JSON.parse(value) as PlayerAppearance;
            if (parsed && (parsed.mode === 'color' || parsed.mode === 'skin') &&
                typeof parsed.colorHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.colorHex)) {
                return parsed;
            }
        } catch { /* Fall through to the safe default. */ }
        return { ...DEFAULT_APPEARANCE };
    }
}
