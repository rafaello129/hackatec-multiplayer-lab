export type ClientIdentity = {
    roomId: string;
    playerName?: string;
    profileId: string;
};

export const DEFAULT_ROOM_ID = 'classroom';

function createProfileId(): string
{
    // getRandomValues is also available on HTTP LAN origins, unlike randomUUID.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

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
    } catch { profileId ||= createProfileId(); }
    return {
        profileId,
        roomId,
        playerName: rawName || undefined
    };
}
