import { AUTO, Game, Scale, type Types } from 'phaser';
import { ArenaScene } from './scenes/ArenaScene';
import { BootScene } from './scenes/BootScene';
import type { RoomStatePayload } from '@hackatec/shared';
import { getSocket } from '../network/socket';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#07111f',
    input: { keyboard: true, gamepad: true },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        BootScene,
        ArenaScene
    ]
};

export function startGame(parent = 'game-container', initialState?: RoomStatePayload)
{
    return new Game({
        ...config,
        parent,
        ...(initialState ? {
            scene: [ArenaScene],
            callbacks: { preBoot: (game: Game) => {
                game.registry.set('initialRoomState', initialState);
                game.registry.set('initialSocketId', getSocket().id);
            } }
        } : {})
    });
}
