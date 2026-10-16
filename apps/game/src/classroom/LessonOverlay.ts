import type { Cameras, GameObjects, Scene } from 'phaser';
import type { DrawCommand, LessonFrame } from './contracts';
import { exercises } from './registry';
import { LessonSession } from './LessonSession';

/** Only this adapter draws in Phaser. Every exercise owns a separate layer. */
export class LessonOverlay {
    private readonly session = new LessonSession(exercises);
    private readonly layers;

    constructor(private readonly scene: Scene, worldCamera: Cameras.Scene2D.Camera) {
        this.layers = exercises.map(exercise => {
            const graphics = scene.add.graphics();
            const container = scene.add.container(0, 0, [graphics]).setDepth(12);
            (exercise.layer === 'world' ? scene.cameras.main : worldCamera).ignore(container);
            return { container, graphics, texts: [] as GameObjects.Text[] };
        });
    }

    update(frame: Omit<LessonFrame, 'previousPlayers'>): void {
        this.session.update(frame).forEach((commands, index) => this.draw(index, commands));
    }

    reset(): void {
        this.session.reset();
        this.layers.forEach((_, index) => this.draw(index, []));
    }

    destroy(): void {
        this.layers.forEach(layer => layer.container.destroy(true));
    }

    private draw(index: number, commands: readonly DrawCommand[]): void {
        const layer = this.layers[index];
        layer.graphics.clear();
        layer.texts.forEach(text => text.setVisible(false));
        let textIndex = 0;
        for (const command of commands) {
            const alpha = command.alpha ?? 1;
            switch (command.kind) {
                case 'circle':
                    layer.graphics.fillStyle(command.color, alpha).fillCircle(command.x, command.y, command.radius);
                    break;
                case 'rect':
                    layer.graphics.fillStyle(command.color, alpha).fillRect(command.x, command.y, command.width, command.height);
                    break;
                case 'line':
                    layer.graphics.lineStyle(command.width, command.color, alpha).lineBetween(command.x, command.y, command.toX, command.toY);
                    break;
                case 'text': {
                    let text = layer.texts[textIndex++];
                    if (!text) {
                        text = this.scene.add.text(0, 0, '', { fontFamily: 'monospace', stroke: '#15201a', strokeThickness: 2 });
                        layer.texts.push(text);
                        layer.container.add(text);
                    }
                    text.setPosition(command.x, command.y).setText(command.text).setColor(command.color)
                        .setFontSize(command.size ?? 12).setAlpha(alpha).setVisible(true);
                    break;
                }
            }
        }
    }
}
