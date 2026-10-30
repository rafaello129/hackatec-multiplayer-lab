import type { PickupState } from '@hackatec/shared';
import { GameObjects, Scene } from 'phaser';

type PickupVisual = {
    container: GameObjects.Container;
    ring: GameObjects.Arc;
    pulse: Phaser.Tweens.Tween;
};

export class PickupView {
    private readonly visuals = new Map<string, PickupVisual>();

    constructor(private readonly scene: Scene) {}

    sync(pickups: PickupState[]): void {
        const visibleIds = new Set(pickups.map(pickup => pickup.id));

        for (const pickup of pickups) {
            let visual = this.visuals.get(pickup.id);
            if (!visual) {
                visual = this.create(pickup);
                this.visuals.set(pickup.id, visual);
            }

            visual.container.setPosition(pickup.x, pickup.y);
            visual.container.setVisible(pickup.active);
        }

        for (const [id, visual] of this.visuals) {
            if (!visibleIds.has(id)) visual.container.setVisible(false);
        }
    }

    clear(): void {
        for (const visual of this.visuals.values()) {
            visual.pulse.stop();
            visual.container.destroy(true);
        }
        this.visuals.clear();
    }

    destroy(): void {
        this.clear();
    }

    private create(pickup: PickupState): PickupVisual {
        const shield = pickup.type === 'shield';
        const glow = this.scene.add.circle(0, 0, 23, shield ? 0x38bdf8 : 0x4ade80, 0.13);
        const ring = this.scene.add.circle(0, 0, 16, shield ? 0x0ea5e9 : 0x16a34a, 0.95)
            .setStrokeStyle(2, shield ? 0xbae6fd : 0xbbf7d0, 1);
        const icon = this.scene.add.text(0, -1, shield ? '◇' : '+', {
            fontFamily: 'Arial Black',
            fontSize: shield ? 24 : 25,
            color: '#ffffff',
            stroke: shield ? '#075985' : '#166534',
            strokeThickness: 3
        }).setOrigin(0.5);
        const container = this.scene.add.container(pickup.x, pickup.y, [glow, ring, icon]).setDepth(2);
        const pulse = this.scene.tweens.add({
            targets: [glow, ring],
            scale: { from: 0.92, to: 1.12 },
            alpha: { from: 0.72, to: 1 },
            duration: 850,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        return { container, ring, pulse };
    }
}
