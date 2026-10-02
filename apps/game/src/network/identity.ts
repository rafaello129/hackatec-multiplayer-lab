export type ClientIdentity = {
    roomId: string;
    playerName?: string;
};

export const DEFAULT_ROOM_ID = 'classroom';

export function getClientIdentity(search: string): ClientIdentity
{
    const params = new URLSearchParams(search);
    const roomId = params.get('room')?.trim() || DEFAULT_ROOM_ID;
    const rawName = params.get('name')?.trim();

    return {
        roomId,
        playerName: rawName || undefined
    };
}
