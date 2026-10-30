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


    it('keeps reserved-owner status on the server-side account record', () => {
        const owner = store.createAccount('Gueta', '$argon2id$test-hash');
        expect(owner.isOwner).toBe(true);
        expect(store.getAccountById(owner.id)?.isOwner).toBe(true);
    });


    it('grants owner status only to the first case-insensitive Gueta registration', () => {
        const owner = store.createAccount('gUeTa', '$argon2id$test-hash');
        expect(owner.isOwner).toBe(true);
        expect(store.getAccountById(owner.id)?.isOwner).toBe(true);
        expect(() => store.createAccount('GUETA', '$argon2id$another-hash')).toThrow(/UNIQUE constraint failed/);
    });

    it('does not let another account claim Gueta by renaming', () => {
        const player = store.createAccount('PlayerOne', '$argon2id$test-hash');
        expect(() => store.updateProfile(player.id, { username: 'GUETA' })).toThrow(/reserved/);
        expect(store.getAccountById(player.id)?.username).toBe('PlayerOne');
    });

    it('does not let the Gueta owner rename away from the reserved name', () => {
        const owner = store.createAccount('Gueta', '$argon2id$test-hash');
        expect(() => store.updateProfile(owner.id, { username: 'PlayerOne' })).toThrow(/cannot be changed/);
        expect(store.getAccountById(owner.id)?.username).toBe('Gueta');
    });

    it('stores only a hash of the session token and resolves the live session', () => {
        const account = store.createAccount('Gueta', '$argon2id$test-hash');
        const token = store.createSession(account.id);
        expect(store.getAccountBySessionToken(token)?.id).toBe(account.id);
        expect(store.getAccountBySessionToken('invalid')).toBeUndefined();
        store.revokeSession(token);
        expect(store.getAccountBySessionToken(token)).toBeUndefined();
    });


    it('updates username and appearance without changing the permanent account id', () => {
        const account = store.createAccount('PlayerOne', '$argon2id$test-hash');
        const updated = store.updateProfile(account.id, {
            username: 'PlayerOne_2',
            appearance: { mode: 'color', colorHex: '#FFFFFF' }
        });
        expect(updated?.id).toBe(account.id);
        expect(updated?.username).toBe('PlayerOne_2');
        expect(updated?.appearance.colorHex).toBe('#FFFFFF');
    });

    it('prevents a profile rename from claiming another account username', () => {
        const first = store.createAccount('PlayerOne', '$argon2id$test-hash');
        store.createAccount('America', '$argon2id$another-hash');
        expect(() => store.updateProfile(first.id, { username: 'aMeRiCa' })).toThrow(/UNIQUE constraint failed/);
        expect(store.getAccountById(first.id)?.username).toBe('PlayerOne');
    });

    it('persists appearance changes without changing account identity', () => {
        const account = store.createAccount('Gueta', '$argon2id$test-hash');
        const updated = store.updateAppearance(account.id, { mode: 'color', colorHex: '#FFFFFF' });
        expect(updated?.id).toBe(account.id);
        expect(updated?.username).toBe('Gueta');
        expect(updated?.appearance.colorHex).toBe('#FFFFFF');
    });
});
