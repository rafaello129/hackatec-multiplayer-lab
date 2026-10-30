import { ARENA_UI_TEXTS, type ConnectionStatus } from '@hackatec/shared';
import { type GameObjects, Scene } from 'phaser';

export class ArenaFrame {
    private readonly background: GameObjects.Graphics;
    private readonly roomText: GameObjects.Text;
    private readonly playerCountText: GameObjects.Text;
    private readonly connectionText: GameObjects.Text;
    private readonly errorText: GameObjects.Text;
    private readonly chrome: GameObjects.GameObject[] = [];

    constructor(scene: Scene, roomId: string) {
        // Keep the arena plate behind the map and all gameplay entities.
        this.background = scene.add.graphics().setDepth(-1);
        this.background
            .fillStyle(0x0b172b, 0.97)
            .fillRoundedRect(20, 14, 984, 100, 14)
            .lineStyle(1, 0x2b4261, 0.95)
            .strokeRoundedRect(20, 14, 984, 100, 14)
            .fillStyle(0x3b82f6, 0.95)
            .fillRoundedRect(20, 14, 4, 100, 2)
            .fillStyle(0x6b4323, 0.10)
            .fillRoundedRect(32, 128, 960, 600, 12)
            .lineStyle(1, 0x263c59, 0.85)
            .strokeRoundedRect(32, 128, 960, 600, 12);

        this.chrome.push(scene.add.text(38, 25, ARENA_UI_TEXTS.brand, {
            fontFamily: 'Arial Black',
            fontSize: 19,
            color: '#f8fafc',
            letterSpacing: 1.2
        }).setDepth(10));

        this.chrome.push(scene.add.text(39, 49, ARENA_UI_TEXTS.subtitle, {
            fontFamily: 'Arial Black',
            fontSize: 9,
            color: '#60a5fa',
            letterSpacing: 2.2
        }).setDepth(10));

        this.roomText = scene.add.text(39, 76, ARENA_UI_TEXTS.roomPrefix + '  ' + roomId, {
            fontFamily: 'Arial',
            fontSize: 13,
            color: '#b8c8dc'
        }).setDepth(10);
        this.chrome.push(this.roomText);

        this.chrome.push(scene.add.rectangle(512, 62, 1, 54, 0x3b526e, 0.6).setDepth(10));

        this.playerCountText = scene.add.text(512, 42, '0 / 32 ' + ARENA_UI_TEXTS.playerCountSuffix, {
            fontFamily: 'Arial Black',
            fontSize: 15,
            color: '#f8fafc',
            align: 'center'
        }).setOrigin(0.5, 0).setDepth(10);
        this.chrome.push(this.playerCountText);

        this.chrome.push(scene.add.text(512, 67, ARENA_UI_TEXTS.sharedArena, {
            fontFamily: 'Arial',
            fontSize: 9,
            color: '#7185a1',
            align: 'center',
            letterSpacing: 1.1
        }).setOrigin(0.5, 0).setDepth(10));

        this.connectionText = scene.add.text(985, 31, '', {
            fontFamily: 'Arial Black',
            fontSize: 12,
            color: '#facc15',
            align: 'right'
        }).setOrigin(1, 0).setDepth(10);
        this.chrome.push(this.connectionText);

        this.chrome.push(scene.add.text(985, 57, ARENA_UI_TEXTS.movementHelp, {
            fontFamily: 'Arial Black',
            fontSize: 9,
            color: '#8194ad',
            align: 'right',
            letterSpacing: 0.5
        }).setOrigin(1, 0).setDepth(10));

        this.errorText = scene.add.text(512, 134, '', {
            fontFamily: 'Arial',
            fontSize: 13,
            color: '#fecdd3',
            backgroundColor: '#4c0519ee',
            padding: { x: 12, y: 7 },
            align: 'center',
            wordWrap: { width: 720 }
        }).setOrigin(0.5, 0).setDepth(40).setVisible(false);
    }

    setMinimalHud(hidden: boolean): void {
        const alpha = hidden ? 0 : 1;
        this.background.setAlpha(alpha);
        for (const item of this.chrome) item.setAlpha(alpha);
    }

    setRoom(roomId: string): void {
        this.roomText.setText(ARENA_UI_TEXTS.roomPrefix + '  ' + roomId);
    }

    setPlayerCount(count: number, maximum = 32): void {
        this.playerCountText.setText(count + ' / ' + maximum + ' ' + ARENA_UI_TEXTS.playerCountSuffix);
    }

    setConnectionStatus(status: ConnectionStatus): void {
        const labels: Record<ConnectionStatus, string> = {
            connecting: ARENA_UI_TEXTS.connection.connecting,
            connected: ARENA_UI_TEXTS.connection.connected,
            disconnected: ARENA_UI_TEXTS.connection.disconnected
        };
        const colors: Record<ConnectionStatus, string> = {
            connecting: '#facc15',
            connected: '#4ade80',
            disconnected: '#fb7185'
        };
        this.connectionText.setText(labels[status]);
        this.connectionText.setColor(colors[status]);
    }

    showError(message: string): void {
        this.errorText.setText(message).setVisible(true);
    }

    clearError(): void {
        this.errorText.setText('').setVisible(false);
    }

    destroy(): void {
        this.background.destroy();
        for (const item of this.chrome) item.destroy();
        this.roomText.destroy();
        this.playerCountText.destroy();
        this.connectionText.destroy();
        this.errorText.destroy();
    }
}
