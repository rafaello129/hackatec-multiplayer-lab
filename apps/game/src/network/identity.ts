function createProfileId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return createProfileId();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

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
            profileId = createProfileId();
            localStorage.setItem('hackatec-profile-id', profileId);
        }
    } catch { profileId = createProfileId(); }
    return {
        profileId,
        roomId,
        playerName: rawName || undefined
    };
}
