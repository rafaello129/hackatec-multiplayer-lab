import { randomUUID } from 'node:crypto';
import { CHAT_BALANCE, type ChatChannel, type ChatHistoryPayload, type ChatMessage, type PlayerState } from '@hackatec/shared';

export type ChatSendResult = {
    ok: boolean;
    message?: ChatMessage;
    error?: string;
};

type RoomChat = {
    all: ChatMessage[];
    spectators: ChatMessage[];
};

export class ChatManager {
    private readonly rooms = new Map<string, RoomChat>();
    private readonly sentAtByAccount = new Map<string, number[]>();

    send(
        roomId: string,
        player: PlayerState,
        accountId: string,
        channel: ChatChannel,
        rawText: unknown,
        now: number
    ): ChatSendResult {
        if (channel !== 'all' && channel !== 'spectators') {
            return { ok: false, error: 'Canal de chat inválido.' };
        }
        if (channel === 'spectators' && !player.spectator) {
            return { ok: false, error: 'Solo los espectadores pueden usar ese canal.' };
        }
        if (typeof rawText !== 'string') return { ok: false, error: 'El mensaje debe ser texto.' };

        const text = rawText.replace(/[\u0000-\u001f\u007f]/g, '').trim();
        if (!text) return { ok: false, error: 'Escribe un mensaje antes de enviarlo.' };
        if ([...text].length > CHAT_BALANCE.maxLength) {
            return { ok: false, error: 'El mensaje supera los 120 caracteres.' };
        }

        const rateLimitKey = roomId + ':' + accountId;
        const recent = (this.sentAtByAccount.get(rateLimitKey) ?? [])
            .filter(timestamp => now - timestamp < CHAT_BALANCE.windowMs);
        if (recent.length >= CHAT_BALANCE.messageLimit) {
            this.sentAtByAccount.set(rateLimitKey, recent);
            return { ok: false, error: 'Estás enviando mensajes demasiado rápido.' };
        }
        recent.push(now);
        this.sentAtByAccount.set(rateLimitKey, recent);

        const message: ChatMessage = {
            id: randomUUID(),
            roomId,
            senderId: player.id,
            senderName: player.name,
            channel,
            text,
            createdAt: now
        };
        const room = this.rooms.get(roomId) ?? { all: [], spectators: [] };
        const history = channel === 'all' ? room.all : room.spectators;
        history.push(message);
        if (history.length > CHAT_BALANCE.historyLimit) history.splice(0, history.length - CHAT_BALANCE.historyLimit);
        this.rooms.set(roomId, room);
        return { ok: true, message };
    }

    getHistory(roomId: string, includeSpectators = false): ChatHistoryPayload {
        const room = this.rooms.get(roomId);
        const messages = includeSpectators
            ? [...(room?.all ?? []), ...(room?.spectators ?? [])]
            : [...(room?.all ?? [])];
        messages.sort((a, b) => a.createdAt - b.createdAt);
        return { roomId, messages: messages.slice(-CHAT_BALANCE.historyLimit) };
    }

    removeRoom(roomId: string): void {
        this.rooms.delete(roomId);
        const prefix = roomId + ':';
        for (const key of this.sentAtByAccount.keys()) {
            if (key.startsWith(prefix)) this.sentAtByAccount.delete(key);
        }
    }
}
