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

    it('persists XP and applies the level-up formula 100 × level^1.5', () => {
        const account = store.createAccount('ProgressPlayer', '$argon2id$test-hash');
        expect(store.getProgression(account.id)).toMatchObject({
            level: 1, xp: 0, totalXP: 0, xpToNextLevel: 100
        });

        const first = store.addXP(account.id, 99);
        expect(first).toMatchObject({ level: 1, xp: 99, totalXP: 99, xpToNextLevel: 100 });

        const second = store.addXP(account.id, 1);
        expect(second).toMatchObject({ level: 2, xp: 0, totalXP: 100, xpToNextLevel: 283 });

        const third = store.addXP(account.id, 283);
        expect(third).toMatchObject({ level: 3, xp: 0, totalXP: 383, xpToNextLevel: 520 });
        expect(store.getProgression(account.id)).toEqual(third);
    });

    it('rejects invalid XP amounts and returns undefined for unknown accounts', () => {
        const account = store.createAccount('ProgressPlayer', '$argon2id$test-hash');
        expect(() => store.addXP(account.id, -1)).toThrow(RangeError);
        expect(() => store.addXP(account.id, 1.5)).toThrow(RangeError);
        expect(() => store.addXP(account.id, 100_001)).toThrow(RangeError);
        expect(store.addXP('missing-account', 50)).toBeUndefined();
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

    it('only lets the account that uploaded a skin assign it to the profile', () => {
        const owner = store.createAccount('SkinOwner', '$argon2id$test-hash');
        const other = store.createAccount('SkinOther', '$argon2id$test-hash');
        const skin = {
            id: '123e4567-e89b-12d3-a456-426614174000.png',
            url: '/skins/123e4567-e89b-12d3-a456-426614174000.png',
            width: 64,
            height: 64
        };

        expect(() => store.updateAppearance(owner.id, {
            mode: 'skin', colorHex: '#60A5FA', skin
        })).toThrow(/does not belong/);

        store.saveSkin(owner.id, skin);
        expect(store.ownsSkin(owner.id, skin)).toBe(true);
        expect(store.ownsSkin(other.id, skin)).toBe(false);

        const updated = store.updateAppearance(owner.id, {
            mode: 'skin', colorHex: '#60A5FA', skin
        });
        expect(updated?.appearance).toEqual({
            mode: 'skin', colorHex: '#60A5FA', skin
        });
        expect(() => store.updateAppearance(other.id, {
            mode: 'skin', colorHex: '#60A5FA', skin
        })).toThrow(/does not belong/);
        expect(store.getAccountById(other.id)?.appearance.mode).toBe('color');
    });

    it('persists appearance changes without changing account identity', () => {
        const account = store.createAccount('Gueta', '$argon2id$test-hash');
        const updated = store.updateAppearance(account.id, { mode: 'color', colorHex: '#FFFFFF' });
        expect(updated?.id).toBe(account.id);
        expect(updated?.username).toBe('Gueta');
        expect(updated?.appearance.colorHex).toBe('#FFFFFF');
    });
});
