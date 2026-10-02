export const DEFAULT_SERVER_URL = 'http://localhost:3001';

export function normalizeServerUrl(value?: string): string
{
    const normalized = value?.trim().replace(/\/+$/, '');

    return normalized || DEFAULT_SERVER_URL;
}
