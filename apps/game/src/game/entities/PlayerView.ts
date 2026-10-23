import type { PlayerState } from '@hackatec/shared';
import { serverUrl } from '../../network/socket';
import { GameObjects, Scene } from 'phaser';

export class PlayerView
{
    readonly container: GameObjects.Container;

    private readonly body: GameObjects.Rectangle;
    private readonly scene: Scene;
    private readonly skin: GameObjects.Image;
    private currentSkin = '';
    private readonly nameText: GameObjects.Text;
    private readonly selfText?: GameObjects.Text;

    constructor(
        scene: Scene,
        player: PlayerState,
        isSelf: boolean
    )
    {
        this.scene = scene;
        this.body = scene.add.rectangle(
            0,
            0,
            42,
            42,
            0x3b82f6,
            1
        );

        this.body.setStrokeStyle(
            isSelf ? 4 : 2,
            0xffffff,
            isSelf ? 1 : 0.55
        );

        this.nameText = scene.add.text(0, -40, player.name, {
            fontFamily: 'Arial',
            fontSize: 15,
            color: '#f8fafc',
            stroke: '#020617',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.skin = scene.add.image(0, 0, '__WHITE').setVisible(false);
        const children: GameObjects.GameObject[] = [
            this.body,
            this.skin,
            this.nameText
        ];

        if (isSelf)
        {
            this.selfText = scene.add.text(0, 38, 'YOU', {
                fontFamily: 'Arial Black',
                fontSize: 11,
                color: '#7dd3fc',
                stroke: '#020617',
                strokeThickness: 3
            }).setOrigin(0.5);

            children.push(this.selfText);
        }

        this.container = scene.add.container(player.x, player.y, children);
        this.update(player);
    }

    update(player: PlayerState)
    {
        this.container.setPosition(player.x, player.y);
        this.body.setFillStyle(0x3b82f6);
        this.nameText.setText(player.name);
    }

    playSpin()
    {
        this.container.scene.tweens.killTweensOf(this.body);

        this.body.x = 0;
        this.body.y = 0;
        this.body.scaleX = 1;
        this.body.scaleY = 1;
        this.body.angle = 0;

        this.container.scene.tweens.add({
            targets: this.body,
            angle: 360,
            duration: 700,
            ease: 'Power2',
            onComplete: () => {
                this.body.angle = 0;
            }
        });
    }

   playJump()
    {
        this.container.scene.tweens.killTweensOf(this.body);

        this.body.x = 0;
        this.body.y = 0;
        this.body.angle = 0;
        this.body.scaleX = 1;
        this.body.scaleY = 1;

        this.container.scene.tweens.add({
            targets: this.body,
            y: -30,
            duration: 160,
            yoyo: true,
            repeat: 1,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.body.x = 0;
                this.body.y = 0;
                this.body.angle = 0;
                this.body.scaleX = 1;
                this.body.scaleY = 1;
            }
        });
    }

    playCrouch()
    {
        this.container.scene.tweens.killTweensOf(this.body);

        this.body.x = 0;
        this.body.y = 0;
        this.body.angle = 0;
        this.body.scaleX = 1;
        this.body.scaleY = 1;

        this.container.scene.tweens.add({
            targets: this.body,
            scaleX: 1.3,
            scaleY: 0.45,
            y: 10,
            duration: 140,
            yoyo: true,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.body.x = 0;
                this.body.y = 0;
                this.body.angle = 0;
                this.body.scaleX = 1;
                this.body.scaleY = 1;
            }
        });
    }

    playShake()
    {
        this.container.scene.tweens.killTweensOf(this.body);

        this.body.x = 0;
        this.body.y = 0;
        this.body.angle = 0;
        this.body.scaleX = 1;
        this.body.scaleY = 1;

        this.container.scene.tweens.add({
            targets: this.body,
            x: -22,
            angle: -12,
            duration: 50,
            yoyo: true,
            repeat: 9,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.body.x = 0;
                this.body.y = 0;
                this.body.angle = 0;
                this.body.scaleX = 1;
                this.body.scaleY = 1;
            }
        });
    }

    destroy()
    {
        this.container.destroy(true);
    }
}
