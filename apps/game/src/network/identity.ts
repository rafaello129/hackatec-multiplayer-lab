function createProfileId(): string {
    const cryptoApi = typeof crypto !== 'undefined' ? crypto : undefined;

    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
        return cryptoApi.randomUUID();
    }

    // getRandomValues is available in HTTP contexts where randomUUID may not be.
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
        const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0'));
        return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }

    // Last-resort fallback for environments without the Web Crypto API.
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
