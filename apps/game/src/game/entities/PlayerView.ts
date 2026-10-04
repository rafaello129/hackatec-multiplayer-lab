import type { PlayerState } from '@hackatec/shared';
import { GameObjects, Scene } from 'phaser';
import { serverUrl } from '../../network/socket';

function hexToNumber(hex: string): number
{
    return Number.parseInt(hex.slice(1), 16);
}

export class PlayerView
{
    readonly container: GameObjects.Container;

    private readonly body: GameObjects.Rectangle;
    private readonly nameText: GameObjects.Text;
    private readonly selfText?: GameObjects.Text;

    private skin?: GameObjects.Image;
    private skinId?: string;

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
            hexToNumber(player.appearance.colorHex),
            1
        );

        this.body.setStrokeStyle(
            isSelf ? 4 : 2,
            0xffffff,
            isSelf ? 1 : 0.55
        );

        this.nameText = scene.add.text(
            0,
            -40,
            player.name,
            {
                fontFamily: 'Arial',
                fontSize: 15,
                color: '#f8fafc',
                stroke: '#020617',
                strokeThickness: 4
            }
        ).setOrigin(0.5);

        const children: GameObjects.GameObject[] = [
            this.body,
            this.nameText
        ];

        if (isSelf)
        {
            this.selfText = scene.add.text(
                0,
                38,
                'YOU',
                {
                    fontFamily: 'Arial Black',
                    fontSize: 11,
                    color: '#7dd3fc',
                    stroke: '#020617',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);

            children.push(this.selfText);
        }

        this.container = scene.add.container(
            player.x,
            player.y,
            children
        );

        this.updateAppearance(player);
    }

    update(player: PlayerState)
    {
        this.container.setPosition(
            player.x,
            player.y
        );

        this.nameText.setText(
            player.name
        );

        this.updateAppearance(player);
    }

    private updateAppearance(player: PlayerState)
    {
        this.body.setFillStyle(
            hexToNumber(player.appearance.colorHex)
        );

        if (
            player.appearance.mode !== 'skin' ||
            !player.appearance.skin
        )
        {
            this.removeSkin();
            this.body.setVisible(true);

            return;
        }

        const skin = player.appearance.skin;

        if (
            this.skinId === skin.id &&
            this.skin
        )
        {
            this.body.setVisible(false);
            return;
        }

        this.removeSkin();

        this.body.setVisible(true);

        this.loadSkin(
            skin.id,
            skin.url,
            skin.width,
            skin.height
        );
    }

    private loadSkin(
        skinId: string,
        skinUrl: string,
        width: number,
        height: number
    )
    {
        const scene = this.container.scene;

        const textureKey =
            `player-skin-${skinId}`;

        const fullUrl =
            skinUrl.startsWith('http')
                ? skinUrl
                : `${serverUrl}${skinUrl}`;

        const showSkin = () =>
        {
            if (
                !scene.textures.exists(
                    textureKey
                )
            )
            {
                return;
            }

            this.skin =
                scene.add.image(
                    0,
                    0,
                    textureKey
                );

            const scaleX =
                42 / width;

            const scaleY =
                42 / height;

            const scale =
                Math.min(
                    scaleX,
                    scaleY
                );

            this.skin.setScale(scale);

            this.container.add(
                this.skin
            );

            this.skin.setDepth(1);

            this.body.setVisible(false);

            this.skinId = skinId;
        };

        if (
            scene.textures.exists(
                textureKey
            )
        )
        {
            showSkin();
            return;
        }

        const image = new Image();

        // Importante para cargar imágenes
        // desde el servidor del juego.
        image.crossOrigin = 'anonymous';

        image.onload = () =>
        {
            if (
                !scene.textures.exists(
                    textureKey
                )
            )
            {
                scene.textures.addImage(
                    textureKey,
                    image
                );
            }

            showSkin();
        };

        image.onerror = () =>
        {
            console.error(
                '[PlayerView] No se pudo cargar la skin:',
                fullUrl
            );

            this.body.setVisible(true);
            this.skinId = undefined;
        };

        image.src = fullUrl;
    }

    private removeSkin()
    {
        if (this.skin)
        {
            this.skin.destroy();
            this.skin = undefined;
        }

        this.skinId = undefined;
    }

    destroy()
    {
        this.container.destroy(true);
    }
}