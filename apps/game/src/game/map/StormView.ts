import type { StormStatePayload } from '@hackatec/shared';
import { GameObjects, Scene } from 'phaser';

export class StormView {
    private readonly graphics: GameObjects.Graphics;
    private readonly status: GameObjects.Text;
    private current?: StormStatePayload;

    constructor(private readonly scene: Scene) {
        this.graphics = scene.add.graphics().setDepth(6).setScrollFactor(0);
        this.status = scene.add.text(36, 151, '', {
            fontFamily: 'Arial Black',
            fontSize: 13,
            color: '#fecaca',
            backgroundColor: '#450a0acc',
            padding: { x: 9, y: 6 }
        }).setDepth(7).setScrollFactor(0).setVisible(false);
    }

    render(state: StormStatePayload): void {
        this.current = state;
        this.status.setVisible(true);
        this.draw();
    }

    setActive(active: boolean): void {
        this.graphics.setVisible(active);
        this.status.setVisible(active && Boolean(this.current));
    }

    update(): void {
        if (this.current && this.graphics.visible) this.draw();
    }

    clear(): void {
        this.current = undefined;
        this.graphics.clear().setVisible(false);
        this.status.setVisible(false);
    }

    destroy(): void {
        this.graphics.destroy();
        this.status.destroy();
    }

    private draw(): void {
        const state = this.current;
        if (!state) return;
        const remaining = Math.max(0, Math.ceil((state.nextPhaseAt - Date.now()) / 1_000));
        const phaseText = state.completed
            ? 'CÍRCULO FINAL'
            : state.closing ? 'CERRANDO' : 'CIERRE EN';
        this.status.setText('TORMENTA · FASE ' + state.phase + '/' + state.phaseCount +
            ' · ' + phaseText + ' ' + remaining + 's');

        this.graphics.clear();
        this.graphics.fillStyle(0xef4444, state.closing ? 0.07 : 0.025);
        this.graphics.fillCircle(state.centerX, state.centerY, state.radius);
        this.graphics.lineStyle(8, 0xef4444, state.closing ? 0.7 : 0.35);
        this.graphics.strokeCircle(state.centerX, state.centerY, state.radius);
        this.graphics.lineStyle(2, 0xfca5a5, 0.9);
        this.graphics.strokeCircle(state.centerX, state.centerY, Math.max(1, state.radius - 6));
    }
}
