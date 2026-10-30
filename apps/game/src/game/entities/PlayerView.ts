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
    private destroyed = false;
    private readonly nameText: GameObjects.Text;
    private readonly trapText: GameObjects.Text;
    private readonly trapBar: GameObjects.Graphics;
    private readonly selfText?: GameObjects.Text;
    private chatBubble?: GameObjects.Text;

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

        this.trapText = scene.add.text(0, -62, '', {
            fontFamily: 'Arial Black', fontSize: 12, color: '#fecaca',
            stroke: '#450a0a', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5).setVisible(false);
        this.trapBar = scene.add.graphics();
        this.skin = scene.add.image(0, 0, '__WHITE').setVisible(false);
        const children: GameObjects.GameObject[] = [
            this.body,
            this.skin,
            this.nameText,
            this.trapText,
            this.trapBar
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
        this.container.setRotation(player.aimAngle ?? player.angle ?? 0);
        const color = player.role === 'titan' ? 0xdc2626
            : player.role === 'hunter' ? 0x2563eb
            : player.appearance?.mode === 'color'
                ? Number.parseInt(player.appearance.colorHex.slice(1), 16)
                : 0x3b82f6;
        this.body.setFillStyle(player.alive === false ? 0x64748b : color);
        this.body.setScale(player.role === 'titan' ? 1.45 : 1);
        this.body.setAlpha(player.isInvulnerable ? 0.5 : player.alive === false ? 0.35 : 1);
        this.skin.setAlpha(player.isInvulnerable ? 0.5 : player.alive === false ? 0.35 : 1);
        this.syncSkin(player);
        const prefix = player.role === 'titan' ? 'TITAN · ' : player.role === 'hunter' ? 'CAZADOR · ' : '';
        this.nameText.setText(prefix + player.name);

        const remainingMs = Math.max(0, (player.immobilizedUntil ?? 0) - Date.now());
        const trapped = remainingMs > 0;
        this.trapText.setVisible(trapped);
        this.trapText.setText(trapped ? `¡ATRAPADO! ${(remainingMs / 1_000).toFixed(1)}s` : '');
        this.trapBar.clear();
        if (trapped) {
            const progress = Math.min(1, remainingMs / 5_000);
            this.trapBar.fillStyle(0x450a0a, 0.9).fillRect(-32, -49, 64, 5);
            this.trapBar.fillStyle(0xf87171, 1).fillRect(-32, -49, 64 * progress, 5);
        }
    }

    private syncSkin(player: PlayerState): void
    {
        const skinPath = player.appearance?.mode === 'skin'
            ? player.appearance.skin?.url
            : undefined;
        if (!skinPath) {
            this.currentSkin = '';
            this.skin.setVisible(false);
            this.body.setVisible(true);
            return;
        }

        const url = new URL(skinPath, serverUrl).toString();
        const textureKey = this.skinTextureKey(url);
        if (this.scene.textures.exists(textureKey)) {
            this.applySkin(textureKey, url);
            return;
        }

        if (this.currentSkin === url) return;
        this.currentSkin = url;
        this.skin.setVisible(false);
        this.body.setVisible(true);

        this.scene.load.once('filecomplete-image-' + textureKey, () => {
            if (this.destroyed || this.currentSkin !== url) return;
            this.applySkin(textureKey, url);
        });
        this.scene.load.image(textureKey, url);
        if (!this.scene.load.isLoading()) this.scene.load.start();
    }

    private skinTextureKey(url: string): string
    {
        let hash = 2_166_136_261;
        for (let index = 0; index < url.length; index += 1) {
            hash ^= url.charCodeAt(index);
            hash = Math.imul(hash, 16_777_619);
        }
        return 'player-skin-' + (hash >>> 0).toString(36);
    }

    private applySkin(textureKey: string, url: string): void
    {
        if (this.destroyed || this.currentSkin !== url || !this.scene.textures.exists(textureKey)) return;
        const size = 42 * (this.body.scaleX || 1);
        this.skin.setTexture(textureKey).setDisplaySize(size, size).setVisible(true);
        this.body.setVisible(false);
    }

    showChat(message: string): void
    {
        if (!this.chatBubble) {
            this.chatBubble = this.scene.add.text(0, -88, '', {
                fontFamily: 'Arial',
                fontSize: 12,
                color: '#f8fafc',
                backgroundColor: '#0f172aee',
                padding: { x: 8, y: 5 },
                align: 'center',
                wordWrap: { width: 180 },
                stroke: '#020617',
                strokeThickness: 2
            }).setOrigin(0.5, 1);
            this.container.add(this.chatBubble);
        }
        this.scene.tweens.killTweensOf(this.chatBubble);
        this.chatBubble.setText([...message].slice(0, 120).join('')).setAlpha(1).setVisible(true);
        this.scene.tweens.add({
            targets: this.chatBubble,
            alpha: 0,
            delay: 3_000,
            duration: 250,
            onComplete: () => this.chatBubble?.setVisible(false)
        });
    }

    showHeal(amount: number)
    {
        const floating = this.scene.add.text(this.container.x, this.container.y - 28, `+${Math.round(amount)}`, {
            fontFamily: 'Arial Black', fontSize: 18, color: '#86efac',
            stroke: '#052e16', strokeThickness: 4
        }).setOrigin(0.5).setDepth(12);
        this.scene.tweens.add({
            targets: floating, y: floating.y - 34, alpha: 0, duration: 850,
            ease: 'Cubic.easeOut', onComplete: () => floating.destroy()
        });
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
        this.destroyed = true;
        this.container.destroy(true);
    }
}
