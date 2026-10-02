import type { PlayerState } from '@hackatec/shared';
import { GameObjects, Scene } from 'phaser';

export class PlayerView
{
    readonly container: GameObjects.Container;

    private readonly body: GameObjects.Rectangle;
    private readonly nameText: GameObjects.Text;
    private readonly selfText?: GameObjects.Text;

    constructor(
        scene: Scene,
        player: PlayerState,
        isSelf: boolean
    )
    {
        this.body = scene.add.rectangle(
            0,
            0,
            42,
            42,
            player.color,
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

        const children: GameObjects.GameObject[] = [
            this.body,
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

        this.container = scene.add.container(
            player.x,
            player.y,
            children
        );
    }

    update(player: PlayerState)
    {
        this.container.setPosition(player.x, player.y);
        this.body.setFillStyle(player.color);
        this.nameText.setText(player.name);
    }

    destroy()
    {
        this.container.destroy(true);
    }
}
