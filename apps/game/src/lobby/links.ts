export function invitationUrl(currentUrl: string, roomId: string): string {
    const url = new URL(currentUrl);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', roomId);
    return url.href;
}

export function roomCode(): string {
    return 'sala-' + Array.from(crypto.getRandomValues(new Uint8Array(5)),
        byte => byte.toString(16).padStart(2, '0')).join('');
}
