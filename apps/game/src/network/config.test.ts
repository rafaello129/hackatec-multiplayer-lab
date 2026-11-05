import { describe, expect, it } from 'vitest';
import { DEFAULT_SERVER_URL, normalizeServerUrl } from './config';

describe('game network configuration', () =>
{
    it('uses localhost by default', () =>
    {
        expect(normalizeServerUrl()).toBe(DEFAULT_SERVER_URL);
    });

    it('uses the page host for LAN clients when no explicit server URL is configured', () =>
    {
        expect(normalizeServerUrl(undefined, '192.168.1.25', 'http:'))
            .toBe('http://192.168.1.25:3001');
    });

    it('preserves HTTPS when inferring the server host', () =>
    {
        expect(normalizeServerUrl('', 'game.example.test', 'https:'))
            .toBe('https://game.example.test:3001');
    });

    it('accepts the professor LAN address', () =>
    {
        expect(
            normalizeServerUrl('http://192.168.1.25:3001/')
        ).toBe('http://192.168.1.25:3001');
    });
});
