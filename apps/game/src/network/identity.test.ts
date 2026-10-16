import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROOM_ID, getClientIdentity } from './identity';

describe('client identity', () =>
{
    afterEach(() => vi.unstubAllGlobals());

    it('creates and persists an identity on HTTP without randomUUID', () => {
        const values = new Map<string, string>();
        vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value)
        });
        const first = getClientIdentity('').profileId;
        expect(first).toMatch(/^[a-f0-9]{32}$/);
        expect(getClientIdentity('').profileId).toBe(first);
    });

    it('can join when storage is unavailable', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => { throw new Error('Storage denied'); }
        });
        expect(getClientIdentity('').profileId).toMatch(/^[a-f0-9]{32}$/);
    });

    it('reads room and name from query parameters', () =>
    {
        expect(
            getClientIdentity('?room=hackatec&name=Ana')
        ).toMatchObject({
            roomId: 'hackatec',
            playerName: 'Ana'
        });
    });

    it('uses a classroom room by default', () =>
    {
        expect(getClientIdentity('')).toMatchObject({
            roomId: DEFAULT_ROOM_ID,
            playerName: undefined
        });
    });

    it('treats a blank name as absent', () =>
    {
        expect(getClientIdentity('?name=%20%20')).toMatchObject({
            roomId: DEFAULT_ROOM_ID,
            playerName: undefined
        });
    });
});
