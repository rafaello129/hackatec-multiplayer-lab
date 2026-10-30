import { describe, expect, it } from 'vitest';
import type { PlayerState } from '@hackatec/shared';
import { publicPlayerState } from './index.js';

describe('publicPlayerState', () => {
    it('hides the restricted laser selection from room broadcasts', () => {
        const player = {
            id: 'player-1',
            name: 'PlayerOne',
            selectedWeapon: 'laser',
            hp: 100,
            maxHp: 100
        } as PlayerState;

        expect(publicPlayerState(player)).toMatchObject({
            id: 'player-1',
            name: 'PlayerOne',
            selectedWeapon: 'pistol',
            hp: 100,
            maxHp: 100
        });
        expect(player.selectedWeapon).toBe('laser');
    });

    it('preserves ordinary weapon selections', () => {
        const player = {
            id: 'player-2',
            name: 'PlayerTwo',
            selectedWeapon: 'sniper'
        } as PlayerState;

        expect(publicPlayerState(player)).toBe(player);
    });
});
