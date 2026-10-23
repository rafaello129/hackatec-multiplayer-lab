import { AUTO, Game, Scale, type Types } from 'phaser';
import { ArenaScene } from './scenes/ArenaScene';
import { BootScene } from './scenes/BootScene';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    input: {
      keyboard: true
    },
    backgroundColor: '#07111f',
<<<<<<< HEAD
    input: { keyboard: true, gamepad: true },
=======
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },

>>>>>>> Emotes-Modos
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        BootScene,
        ArenaScene
    ]
};

export function startGame(parent = 'game-container') {
    return new Game({
        ...config,
        parent
    });
}