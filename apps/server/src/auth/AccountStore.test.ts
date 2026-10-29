import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountStore } from './AccountStore.js';

describe('AccountStore', () => {
    let directory: string;
    let store: AccountStore;

    beforeEach(() => {
        directory = mkdtempSync(path.join(os.tmpdir(), 'hackatec-accounts-'));
        store = new AccountStore(path.join(directory, 'accounts.sqlite'));
    });

    afterEach(() => {
        store.close();
        rmSync(directory, { recursive: true, force: true });
    });

    it('persists an account and its appearance in SQLite', () => {
        const created = store.createAccount('Gueta', '$argon2id$test-hash');
        const loaded = store.getAccountById(created.id);
        expect(loaded?.username).toBe('Gueta');
        expect(loaded?.appearance).toEqual({ mode: 'color', colorHex: '#60A5FA' });
    });

    it('uses a case-insensitive unique username key', () => {
        store.createAccount('Gueta', '$argon2id$test-hash');
        expect(() => store.createAccount('gUeTa', '$argon2id$another-hash')).toThrow(/UNIQUE constraint failed/);
    });

    it('stores only a hash of the session token and resolves the live session', () => {
        const account = store.createAccount('Gueta', '$argon2id$test-hash');
        const token = store.createSession(account.id);
        expect(store.getAccountBySessionToken(token)?.id).toBe(account.id);
        expect(store.getAccountBySessionToken('invalid')).toBeUndefined();
        store.revokeSession(token);
        expect(store.getAccountBySessionToken(token)).toBeUndefined();
    });

    it('persists appearance changes without changing account identity', () => {
        const account = store.createAccount('Gueta', '$argon2id$test-hash');
        const updated = store.updateAppearance(account.id, { mode: 'color', colorHex: '#FFFFFF' });
        expect(updated?.id).toBe(account.id);
        expect(updated?.username).toBe('Gueta');
        expect(updated?.appearance.colorHex).toBe('#FFFFFF');
    });
});
