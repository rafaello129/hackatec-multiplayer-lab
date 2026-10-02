import { describe, expect, it } from 'vitest';
import { getAllowedOrigins, getServerConfig } from './env.js';

describe('server configuration', () =>
{
    it('uses classroom-safe development defaults', () =>
    {
        expect(getServerConfig({})).toEqual({
            host: '0.0.0.0',
            port: 3001,
            corsOrigin: '*'
        });
    });

    it('accepts explicit LAN configuration', () =>
    {
        expect(getServerConfig({
            HOST: '0.0.0.0',
            PORT: '4000',
            CORS_ORIGIN: 'http://192.168.1.40:5173'
        })).toEqual({
            host: '0.0.0.0',
            port: 4000,
            corsOrigin: 'http://192.168.1.40:5173'
        });
    });

    it('parses multiple allowed origins', () =>
    {
        expect(
            getAllowedOrigins('http://localhost:5173, http://192.168.1.40:5173')
        ).toEqual([
            'http://localhost:5173',
            'http://192.168.1.40:5173'
        ]);
    });
});
