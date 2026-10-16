import { describe, expect, it } from 'vitest';
import { invitationUrl, roomCode } from './links';

describe('lobby invitations', () => {
    it('shares the room without the sender name or other parameters', () => {
        expect(invitationUrl('http://192.168.1.4:5173/game/?name=Ana&token=private#debug', 'equipo-1'))
            .toBe('http://192.168.1.4:5173/game/?room=equipo-1');
    });
    it('generates codes compatible with room identifiers on HTTP', () => {
        expect(roomCode()).toMatch(/^sala-[a-f0-9]{10}$/);
        expect(roomCode()).not.toBe(roomCode());
    });
});
