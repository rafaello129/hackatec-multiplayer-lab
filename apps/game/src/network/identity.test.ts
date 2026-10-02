import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_ID, getClientIdentity } from './identity';

describe('client identity', () =>
{
    it('reads room and name from query parameters', () =>
    {
        expect(
            getClientIdentity('?room=hackatec&name=Ana')
        ).toEqual({
            roomId: 'hackatec',
            playerName: 'Ana'
        });
    });

    it('uses a classroom room by default', () =>
    {
        expect(getClientIdentity('')).toEqual({
            roomId: DEFAULT_ROOM_ID,
            playerName: undefined
        });
    });

    it('treats a blank name as absent', () =>
    {
        expect(getClientIdentity('?name=%20%20')).toEqual({
            roomId: DEFAULT_ROOM_ID,
            playerName: undefined
        });
    });
});
