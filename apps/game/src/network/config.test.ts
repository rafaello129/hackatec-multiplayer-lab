import { describe, expect, it } from 'vitest';
import { DEFAULT_SERVER_URL, normalizeServerUrl } from './config';

describe('game network configuration', () =>
{
    it('uses localhost by default', () =>
    {
        expect(normalizeServerUrl()).toBe(DEFAULT_SERVER_URL);
    });

    it('accepts the professor LAN address', () =>
    {
        expect(
            normalizeServerUrl('http://192.168.1.25:3001/')
        ).toBe('http://192.168.1.25:3001');
    });
});
