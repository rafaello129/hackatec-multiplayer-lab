export const DEFAULT_SERVER_URL = 'http://localhost:3001';

export function normalizeServerUrl(
    value?: string,
    browserHostname?: string,
    browserProtocol = 'http:'
): string
{
    const normalized = value?.trim().replace(/\/+$/, '');
    if (normalized) return normalized;

    // When the game is opened from another device on a LAN, localhost would
    // point to that device. Reuse the host that served the client instead.
    if (browserHostname) return `${browserProtocol}//${browserHostname}:3001`;
    return DEFAULT_SERVER_URL;
}
