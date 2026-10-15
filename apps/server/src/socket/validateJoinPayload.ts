import type { JoinRoomPayload } from '@hackatec/shared';

export type ParsedJoinPayload =
    | { ok: true; value: JoinRoomPayload }
    | { ok: false; message: string };

/** Validate external Socket.IO input before passing it to RoomManager. */
export function parseJoinPayload(input: unknown): ParsedJoinPayload
{
    if (!input || typeof input !== 'object' || Array.isArray(input))
    {
        return { ok: false, message: 'El mensaje de entrada debe ser un objeto.' };
    }

    const value = input as Record<string, unknown>;

    if (typeof value.roomId !== 'string')
    {
        return { ok: false, message: 'roomId debe ser una cadena.' };
    }

    if (value.playerName !== undefined && typeof value.playerName !== 'string')
    {
        return { ok: false, message: 'playerName debe ser una cadena.' };
    }

    if (typeof value.playerName === 'string' && value.playerName.length > 256)
    {
        return { ok: false, message: 'playerName excede el límite de entrada.' };
    }

    return {
        ok: true,
        value: {
            roomId: value.roomId,
            playerName: value.playerName as string | undefined
        }
    };
}
