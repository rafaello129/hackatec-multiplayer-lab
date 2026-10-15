import { describe, expect, it } from 'vitest';
import { parseJoinPayload } from './validateJoinPayload.js';

describe('parseJoinPayload', () =>
{
    it('accepts a minimal valid payload', () =>
    {
        expect(parseJoinPayload({ roomId: 'classroom' })).toEqual({
            ok: true,
            value: { roomId: 'classroom', playerName: undefined }
        });
    });

    it.each([null, undefined, 1, 'classroom', [], {}])(
        'rejects malformed payload %s',
        (input) => expect(parseJoinPayload(input).ok).toBe(false)
    );

    it('rejects non-string names', () =>
    {
        expect(parseJoinPayload({ roomId: 'room', playerName: 123 }).ok).toBe(false);
    });

    it('rejects oversized names', () =>
    {
        expect(parseJoinPayload({ roomId: 'room', playerName: 'a'.repeat(257) }).ok).toBe(false);
    });
});
