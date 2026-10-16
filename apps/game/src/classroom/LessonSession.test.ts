import { describe, expect, it } from 'vitest';
import type { PlayerState } from '@hackatec/shared';
import type { LessonDefinition, LessonFrame } from './contracts';
import { LessonSession } from './LessonSession';

const player: PlayerState = { id: 'self', name: 'Piloto', x: 100, y: 200, color: 0xffffff, hp: 100 };
const input = (players: PlayerState[] = [player]): Omit<LessonFrame, 'previousPlayers'> => ({
    time: 100, delta: 16, selfId: 'self', players,
    map: { seed: 1, width: 2304, height: 1536, obstacles: [] },
    pointer: null, weapon: 'pistol', editingProfile: false
});

describe('classroom integration', () => {
    it('keeps previous player data stable and clears history on reset', () => {
        const histories: LessonFrame['previousPlayers'][] = [];
        const session = new LessonSession([{ id: 'probe', layer: 'world', create: () => ({
            update(frame) { histories.push(frame.previousPlayers); return []; }
        }) }]);
        const mutablePlayer = { ...player };
        session.update(input([mutablePlayer]));
        mutablePlayer.hp = 75;
        session.update(input([mutablePlayer]));
        session.reset();
        session.update(input([mutablePlayer]));
        expect(histories[0]).toEqual([]);
        expect(histories[1][0].hp).toBe(100);
        expect(histories[2]).toEqual([]);
    });

    it('isolates exercise closures between slots, sessions and reconnections', () => {
        const definition: LessonDefinition = { id: 'probe', layer: 'world', create: () => {
            let count = 0;
            return { update: () => [{ kind: 'text', x: 0, y: 0, text: String(++count), color: '#fff' }] };
        } };
        const session = new LessonSession([definition, { ...definition, id: 'second' }]);
        const otherSession = new LessonSession([definition]);
        const first = session.update(input());
        expect(first[0]).toEqual(first[1]);
        expect(session.update(input())[0]).not.toEqual(first[0]);
        expect(otherSession.update(input())[0]).toEqual(first[0]);
        session.reset();
        expect(session.update(input())).toEqual(first);
    });
});
