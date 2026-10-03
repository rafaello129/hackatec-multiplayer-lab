import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_ID, getClientIdentity } from './identity';

const storage = new Map<string, string>();

beforeEach(() =>
{
    storage.clear();

    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) =>
            {
                storage.set(key, value);
            }
        },
        configurable: true
    });
});

describe('client identity', () =>
{
    it('reads room and name from query parameters', () =>
    {
        const identity = getClientIdentity('?room=hackatec&name=Ana');

        expect(identity.roomId).toBe('hackatec');
        expect(identity.playerName).toBe('Ana');
        expect(identity.profileId).toEqual(expect.any(String));
    });

    it('uses a classroom room by default', () =>
    {
        const identity = getClientIdentity('');

        expect(identity.roomId).toBe(DEFAULT_ROOM_ID);
        expect(identity.playerName).toBeUndefined();
        expect(identity.profileId).toEqual(expect.any(String));
    });

    it('treats a blank name as absent', () =>
    {
        const identity = getClientIdentity('?name=%20%20');

        expect(identity.roomId).toBe(DEFAULT_ROOM_ID);
        expect(identity.playerName).toBeUndefined();
        expect(identity.profileId).toEqual(expect.any(String));
    });
});
