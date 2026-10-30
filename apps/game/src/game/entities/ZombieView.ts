import type { ZombieStatePayload } from '@hackatec/shared';
import { GameObjects, Scene } from 'phaser';

type ZombieVisual = {
    container: GameObjects.Container;
    body: GameObjects.Arc;
    label: GameObjects.Text;
    health: GameObjects.Graphics;
};

export class ZombieView {
    private readonly visuals = new Map<string, ZombieVisual>();
    private readonly effects: GameObjects.Graphics;

    constructor(private readonly scene: Scene) {
        this.effects = scene.add.graphics().setDepth(1);
    }

    sync(state: ZombieStatePayload): void {
        const visible = new Set(state.zombies.map(zombie => zombie.id));
        for (const zombie of state.zombies) {
            let visual = this.visuals.get(zombie.id);
            if (!visual) {
                visual = this.create(zombie.type);
                this.visuals.set(zombie.id, visual);
            }
            visual.container.setPosition(zombie.x, zombie.y);
            visual.container.setAlpha(zombie.alive ? 1 : 0.25);
            visual.label.setText(zombie.type === 'boss' ? 'JEFE FINAL' : zombie.type === 'giant' ? 'GIGANTE' : 'ESCUPIDOR');
            visual.health.clear();
            visual.health.fillStyle(0x334155, 0.95).fillRect(zombie.type === 'boss' ? -42 : -24, -40, zombie.type === 'boss' ? 84 : 48, 6);
            visual.health.fillStyle(zombie.type === 'boss' ? 0xf97316 : zombie.type === 'giant' ? 0xef4444 : 0xa78bfa, 1)
                .fillRect(zombie.type === 'boss' ? -42 : -24, -40, (zombie.type === 'boss' ? 84 : 48) * Math.max(0, zombie.hp) / Math.max(1, zombie.maxHp), 6);
            if (zombie.phase === 'telegraph') {
                visual.body.setStrokeStyle(4, 0xfacc15, 1);
            } else if (zombie.phase === 'charge') {
                visual.body.setStrokeStyle(4, 0xf97316, 1);
            } else if (zombie.phase === 'stunned') {
                visual.body.setStrokeStyle(4, 0x38bdf8, 1);
            } else {
                visual.body.setStrokeStyle(2, 0xffffff, 0.8);
            }
            visual.container.setVisible(true);
        }

        for (const [id, visual] of this.visuals) {
            if (!visible.has(id)) visual.container.setVisible(false);
        }

        this.effects.clear();
        for (const puddle of state.puddles) {
            this.effects.fillStyle(0x65a30d, 0.22).fillCircle(puddle.x, puddle.y, puddle.radius);
            this.effects.lineStyle(2, 0x84cc16, 0.8).strokeCircle(puddle.x, puddle.y, puddle.radius);
        }
        for (const projectile of state.projectiles) {
            this.effects.fillStyle(0x84cc16, 1).fillCircle(projectile.x, projectile.y, 8);
            this.effects.lineStyle(2, 0xecfccb, 0.9).strokeCircle(projectile.x, projectile.y, 8);
        }
    }

    clear(): void {
        for (const visual of this.visuals.values()) visual.container.destroy(true);
        this.visuals.clear();
        this.effects.clear();
    }

    destroy(): void {
        this.clear();
        this.effects.destroy();
    }

    private create(type: 'giant' | 'spitter' | 'boss'): ZombieVisual {
        const giant = type !== 'spitter';
        const boss = type === 'boss';
        const body = this.scene.add.circle(0, 0, boss ? 54 : giant ? 29 : 22, boss ? 0x7f1d1d : giant ? 0x991b1b : 0x6d28d9, 1)
            .setStrokeStyle(2, 0xffffff, 0.8);
        const label = this.scene.add.text(0, boss ? -76 : giant ? -49 : -40, boss ? 'JEFE FINAL' : giant ? 'GIGANTE' : 'ESCUPIDOR', {
            fontFamily: 'Arial Black',
            fontSize: 10,
            color: '#ffffff',
            stroke: '#020617',
            strokeThickness: 3
        }).setOrigin(0.5);
        const health = this.scene.add.graphics();
        const container = this.scene.add.container(0, 0, [body, label, health]).setDepth(2);
        return { container, body, label, health };
    }
}
