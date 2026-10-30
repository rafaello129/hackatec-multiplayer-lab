import { describe, expect, it } from 'vitest';
import type { PlayerState } from '@hackatec/shared';
import { CHAT_BALANCE } from '@hackatec/shared';
import { ChatManager } from './ChatManager.js';

const player = (id: string, spectator = false): PlayerState => ({
    id, name: id, x: 0, y: 0, alive: true, spectator
});

describe('ChatManager', () => {
    it('stores sanitized messages and provides separate spectator history', () => {
        const manager = new ChatManager();
        const active = player('active');
        const spectator = player('spectator', true);

        expect(manager.send('room', active, 'account-a', 'all', '  Hola\u0000 mundo  ', 1_000).message?.text)
            .toBe('Hola mundo');
        expect(manager.send('room', spectator, 'account-b', 'spectators', '¿Me escuchan?', 1_050).ok)
            .toBe(true);

        expect(manager.getHistory('room').messages).toHaveLength(1);
        expect(manager.getHistory('room', true).messages).toHaveLength(2);
    });

    it('rejects overlong, blank and invalid spectator-channel messages', () => {
        const manager = new ChatManager();
        expect(manager.send('room', player('active'), 'a', 'all', ' '.repeat(8), 1).ok).toBe(false);
        expect(manager.send('room', player('active'), 'a', 'all', 'x'.repeat(CHAT_BALANCE.maxLength + 1), 2).ok).toBe(false);
        expect(manager.send('room', player('active'), 'a', 'spectators', 'secret', 3).ok).toBe(false);
        expect(manager.send('room', player('spectator', true), 'b', 'all', 'public leak', 4).ok).toBe(false);
    });

    it('limits messages per account across multiple sockets', () => {
        const manager = new ChatManager();
        for (let index = 0; index < CHAT_BALANCE.messageLimit; index += 1) {
            expect(manager.send('room', player('socket-' + index), 'same-account', 'all', 'message', 1_000 + index).ok)
                .toBe(true);
        }
        expect(manager.send('room', player('new-socket'), 'same-account', 'all', 'too much', 1_100).ok)
            .toBe(false);
        expect(manager.send('room', player('new-socket'), 'same-account', 'all', 'after window', 11_001).ok)
            .toBe(true);
    });

    it('caps history to the newest 40 messages', () => {
        const manager = new ChatManager();
        for (let index = 0; index < CHAT_BALANCE.historyLimit + 4; index += 1) {
            expect(manager.send('room', player('p'), 'account', 'all', 'message ' + index, 1_000 + index * 2_001).ok)
                .toBe(true);
        }
        const history = manager.getHistory('room').messages;
        expect(history).toHaveLength(CHAT_BALANCE.historyLimit);
        expect(history[0]?.text).toBe('message 4');
    });

    it('removes room history and rate-limit records', () => {
        const manager = new ChatManager();
        manager.send('room', player('p'), 'account', 'all', 'hello', 1_000);
        manager.removeRoom('room');
        expect(manager.getHistory('room').messages).toEqual([]);
    });
});
