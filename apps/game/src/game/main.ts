import { AUTO, Game, Scale, type Types } from 'phaser';
import { BootScene } from './scenes/BootScene';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#07111f',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        BootScene
    ]
};

export function startGame(parent = 'game-container')
{
    return new Game({
        ...config,
        parent
    });
}
