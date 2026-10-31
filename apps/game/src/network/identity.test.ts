import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROOM_ID, getClientIdentity } from './identity';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('client identity', () => {
    it('reads room and name from query parameters', () => {
        expect(
            getClientIdentity('?room=hackatec&name=Ana')
        ).toMatchObject({
            roomId: 'hackatec',
            playerName: 'Ana'
        });
    });

    it('uses a classroom room by default', () => {
        expect(getClientIdentity('')).toMatchObject({
            roomId: DEFAULT_ROOM_ID,
            playerName: undefined
        });
    });

    it('treats a blank name as absent', () => {
        expect(getClientIdentity('?name=%20%20')).toMatchObject({
            roomId: DEFAULT_ROOM_ID,
            playerName: undefined
        });
    });

    it('uses crypto.randomUUID when available', () => {
        const randomUUID = vi.fn(() => 'generated-profile-id');
        vi.stubGlobal('localStorage', undefined);
        vi.stubGlobal('crypto', { randomUUID } as unknown as Crypto);

        expect(getClientIdentity('').profileId).toBe('generated-profile-id');
        expect(randomUUID).toHaveBeenCalledTimes(1);
    });

    it('uses crypto.getRandomValues when randomUUID is unavailable', () => {
        const getRandomValues = vi.fn((bytes: Uint8Array) => {
            bytes.fill(1);
            return bytes;
        });
        vi.stubGlobal('localStorage', undefined);
        vi.stubGlobal('crypto', { getRandomValues } as unknown as Crypto);

        expect(getClientIdentity('').profileId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
        expect(getRandomValues).toHaveBeenCalledTimes(1);
    });

    it('falls back when the Web Crypto API is unavailable', () => {
        vi.stubGlobal('localStorage', undefined);
        vi.stubGlobal('crypto', undefined);

        expect(getClientIdentity('').profileId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
    });
});
