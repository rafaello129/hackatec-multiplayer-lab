import { describe, expect, it } from 'vitest';
import type { PlayerState } from '@hackatec/shared';
import { PlayerRegistry } from './PlayerRegistry';

function player(id: string, name: string): PlayerState
{
    return {
        id,
        name,
        x: 100,
        y: 200,
        color: 0x4ade80,
        appearance: {
            mode: 'color',
            colorHex: '#4ADE80'
    }
    };
}

describe('PlayerRegistry', () =>
{
    it('replaces the complete room snapshot', () =>
    {
        const registry = new PlayerRegistry();

        registry.add(player('old', 'Old'));
        registry.replaceAll([
            player('a', 'Ana'),
            player('b', 'Luis')
        ]);

        expect(registry.getAll().map((item) => item.id)).toEqual(['a', 'b']);
    });

    it('adds or updates by player id', () =>
    {
        const registry = new PlayerRegistry();

        registry.add(player('a', 'Ana'));
        registry.add(player('a', 'Ana María'));

        expect(registry.size).toBe(1);
        expect(registry.get('a')?.name).toBe('Ana María');
    });

    it('removes players cleanly', () =>
    {
        const registry = new PlayerRegistry();

        registry.add(player('a', 'Ana'));

        expect(registry.remove('a')).toBe(true);
        expect(registry.size).toBe(0);
    });
});
