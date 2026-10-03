export type ClientIdentity = {
    roomId: string;
    playerName?: string;
    profileId: string;
};

export const DEFAULT_ROOM_ID = 'classroom';
export const PROFILE_ID_STORAGE_KEY = 'hackatec_profile_id';

function getOrCreateProfileId(): string
{
    const existingProfileId = localStorage.getItem(PROFILE_ID_STORAGE_KEY);

    if (existingProfileId)
    {
        return existingProfileId;
    }

    const profileId = crypto.randomUUID();

    localStorage.setItem(PROFILE_ID_STORAGE_KEY, profileId);

    return profileId;
}

export function getClientIdentity(search: string): ClientIdentity
{
    const params = new URLSearchParams(search);
    const roomId = params.get('room')?.trim() || DEFAULT_ROOM_ID;
    const rawName = params.get('name')?.trim();

    return {
        roomId,
        playerName: rawName || undefined,
        profileId: getOrCreateProfileId()
    };
}