export type ClientIdentity = {
    roomId: string;
    playerName?: string;
    profileId: string;
};

export const DEFAULT_ROOM_ID = 'classroom';

export function getClientIdentity(search: string): ClientIdentity
{
    const params = new URLSearchParams(search);
    const roomId = params.get('room')?.trim() || DEFAULT_ROOM_ID;
    const rawName = params.get('name')?.trim();

    let profileId = '';
    try {
        profileId = localStorage.getItem('hackatec-profile-id') ?? '';
        if (!profileId) {
            profileId = crypto.randomUUID();
            localStorage.setItem('hackatec-profile-id', profileId);
        }
    } catch { profileId = crypto.randomUUID(); }
    return {
        profileId,
        roomId,
        playerName: rawName || undefined
    };
}
