import { describe, expect, it } from 'vitest';
import { SOCKET_EVENTS } from './events.js';

describe('shared socket contracts', () =>
{
    it('keeps the connection-ready event stable', () =>
    {
        expect(SOCKET_EVENTS.CONNECTION_READY).toBe('connection:ready');
    });
});
