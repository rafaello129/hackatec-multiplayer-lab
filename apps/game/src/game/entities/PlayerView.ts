import type { PlayerState } from '@hackatec/shared';
import { serverUrl } from '../../network/socket';
import { GameObjects, Scene } from 'phaser';
import { SHIP_TEXTURE } from '../assets';

export class PlayerView
{
    readonly container: GameObjects.Container;

    private readonly body: GameObjects.Rectangle;
    private readonly scene: Scene;
    private readonly skin: GameObjects.Image;
    private readonly ship: GameObjects.Image;
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
            player.color,
            1
        );

        this.body.setStrokeStyle(
            isSelf ? 4 : 2,
            0xffffff,
            isSelf ? 1 : 0.55
        );

        this.nameText = scene.add.text(0, -33, player.name, {
            fontFamily: 'Arial',
            fontSize: 12,
            color: '#fff7e4',
            stroke: '#343a2d',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.skin = scene.add.image(0, 0, '__WHITE').setVisible(false);
        this.ship = scene.add.image(0, 0, SHIP_TEXTURE).setDisplaySize(42, 42);
        this.ship.setVisible(scene.textures.exists(SHIP_TEXTURE));
        const children: GameObjects.GameObject[] = [
            this.body,
            this.ship,
            this.skin,
            this.nameText
        ];

        if (isSelf)
        {
            this.selfText = scene.add.text(0, 30, 'TÚ', {
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
        const color = player.appearance?.colorHex;
        this.body.setFillStyle(color ? parseInt(color.slice(1),16) : player.color, 0);
        this.body.setStrokeStyle(0);
        const url = player.appearance?.mode === 'skin' ? player.appearance.skin?.url : undefined;
        const hasShip = this.scene.textures.exists(SHIP_TEXTURE);
        this.ship.setVisible(!url && hasShip);
        if (!hasShip && !url) this.body.setFillStyle(color ? parseInt(color.slice(1),16) : player.color);
        if (!url) { this.currentSkin = ''; this.skin.setVisible(false); this.body.setVisible(true); }
        else if (url === this.currentSkin && this.scene.textures.exists('skin:' + url)) {
            this.skin.setTexture('skin:' + url).setDisplaySize(42,42).setVisible(true);
            this.body.setVisible(false);
        }
        else if (url !== this.currentSkin) {
            this.currentSkin = url;
            const key = 'skin:' + url;
            const fullUrl = new URL(url, serverUrl).href;
            if (this.scene.textures.exists(key)) { this.skin.setTexture(key).setDisplaySize(42,42).setVisible(true); this.body.setVisible(false); }
            else {
                this.scene.load.image(key, fullUrl);
                this.scene.load.once('filecomplete-image-' + key, () => { if (this.currentSkin === url) { this.skin.setTexture(key).setDisplaySize(42,42).setVisible(true); this.body.setVisible(false); } });
                this.scene.load.start();
            }
        }
        this.container.setAlpha(player.alive === false ? 0.25 : player.connected === false ? 0.5 : player.isDashing ? 0.55 : 1);
        if (player.isDashing) this.body.setStrokeStyle(3, 0xf0abfc);

        this.nameText.setText(player.name + (player.connected === false ? ' · reconectando' : ''));
        this.nameText.setColor(color ?? '#fff7e4');
    }

    destroy()
    {
        this.container.destroy(true);
    }
}
