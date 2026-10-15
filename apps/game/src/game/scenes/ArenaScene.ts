import {
    SOCKET_EVENTS,
    type ConnectionStatus,
    type JoinRoomPayload,
    type PlayerJoinedPayload,
    type PlayerLeftPayload,
    type PlayerState,
    type PlayerInput,
    type PlayerMovedPayload,
    type CombatSnapshot,
    type WeaponType,
    type RoomErrorPayload,
    type RoomStatePayload
} from '@hackatec/shared';
import { Scene, type GameObjects, Input, type Types } from 'phaser';
import type { Socket } from 'socket.io-client';
import { MapView } from '../map/MapView';
import { PlayerView } from '../entities/PlayerView';
import { getClientIdentity, type ClientIdentity } from '../../network/identity';
import { getSocket } from '../../network/socket';
import { PlayerRegistry } from '../../state/PlayerRegistry';

export class ArenaScene extends Scene
{
    private socket!: Socket;
    private identity!: ClientIdentity;
    private readonly playerRegistry = new PlayerRegistry();
    private readonly playerViews = new Map<string, PlayerView>();

    private selfId = '';
    private mapView?: MapView;
    private cursors?: Types.Input.Keyboard.CursorKeys;
    private keys?: { w: Input.Keyboard.Key; a: Input.Keyboard.Key; s: Input.Keyboard.Key; d: Input.Keyboard.Key; shift: Input.Keyboard.Key };
    private previousInput = '';
    private lastInputSent = 0;
    private weapon: WeaponType = 'pistol';
    private lastShot = 0;
    private fireHeld = false;
    private bullets?: GameObjects.Graphics;
    private combatText?: GameObjects.Text;

    private roomText!: GameObjects.Text;
    private playerCountText!: GameObjects.Text;
    private connectionText!: GameObjects.Text;
    private errorText!: GameObjects.Text;

    constructor()
    {
        super('ArenaScene');
    }

    create()
    {
        this.cameras.main.setBackgroundColor('#07111f');

        this.identity = getClientIdentity(window.location.search);
        this.socket = getSocket();

        this.cursors = this.input.keyboard?.createCursorKeys();
        if (this.input.keyboard) {
            const k = Input.Keyboard.KeyCodes;
            this.keys = { w: this.input.keyboard.addKey(k.W), a: this.input.keyboard.addKey(k.A), s: this.input.keyboard.addKey(k.S), d: this.input.keyboard.addKey(k.D), shift: this.input.keyboard.addKey(k.SHIFT) };
        }
        this.createInterface();
        this.mapView = new MapView(this);
        this.bullets = this.add.graphics().setDepth(3);
        this.combatText = this.add.text(36, 105, '', { fontFamily: 'Arial', fontSize: 15, color: '#f8fafc' }).setDepth(5);
        this.input.keyboard?.on('keydown-ONE', this.pistol);
        this.input.keyboard?.on('keydown-TWO', this.machineGun);
        this.input.keyboard?.on('keydown-THREE', this.shotgun);
        this.attachSocketListeners();

        this.events.once('shutdown', () =>
        {
            this.detachSocketListeners();
            this.clearPlayerViews();
            this.mapView?.destroy();
            this.input.keyboard?.off('keydown-ONE', this.pistol);
            this.input.keyboard?.off('keydown-TWO', this.machineGun);
            this.input.keyboard?.off('keydown-THREE', this.shotgun);
        });

        if (this.socket.connected)
        {
            this.setConnectionStatus('connected');
            this.joinRoom();
        }
        else
        {
            this.setConnectionStatus('connecting');
            this.socket.connect();
        }
    }

    private createInterface()
    {
        this.add.rectangle(512, 64, 984, 96, 0x0f172a, 0.96)
            .setStrokeStyle(1, 0x334155, 0.8);

        this.add.text(36, 28, 'HACKATEC MULTIPLAYER LAB', {
            fontFamily: 'Arial Black',
            fontSize: 20,
            color: '#f8fafc'
        });

        this.roomText = this.add.text(36, 68, `Sala: ${this.identity.roomId}`, {
            fontFamily: 'Arial',
            fontSize: 16,
            color: '#cbd5e1'
        });

        this.playerCountText = this.add.text(512, 45, 'Players: 0', {
            fontFamily: 'Arial Black',
            fontSize: 18,
            color: '#f8fafc'
        }).setOrigin(0.5);

        this.connectionText = this.add.text(988, 30, '', {
            fontFamily: 'Arial Black',
            fontSize: 14,
            color: '#facc15',
            align: 'right'
        }).setOrigin(1, 0);

        this.add.text(988, 68, 'Mapa compartido · movimiento sincronizado', {
            fontFamily: 'Arial',
            fontSize: 12,
            color: '#64748b',
            align: 'right'
        }).setOrigin(1, 0);

        this.add.rectangle(512, 438, 960, 600, 0x020617, 0.38)
            .setStrokeStyle(1, 0x1e293b, 0.9);

        this.errorText = this.add.text(512, 134, '', {
            fontFamily: 'Arial',
            fontSize: 16,
            color: '#fda4af',
            backgroundColor: '#4c0519cc',
            padding: { x: 10, y: 5 },
            align: 'center'
        }).setOrigin(0.5).setVisible(false);

        this.add.text(512, 730, 'WASD / flechas para moverse · SHIFT para dash', {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#64748b'
        }).setOrigin(0.5);
    }

    private attachSocketListeners()
    {
        this.socket.on('connect', this.handleConnect);
        this.socket.on('disconnect', this.handleDisconnect);
        this.socket.on(SOCKET_EVENTS.ROOM_STATE, this.handleRoomState);
        this.socket.on(SOCKET_EVENTS.ROOM_ERROR, this.handleRoomError);
        this.socket.on(SOCKET_EVENTS.PLAYER_JOINED, this.handlePlayerJoined);
        this.socket.on(SOCKET_EVENTS.PLAYER_LEFT, this.handlePlayerLeft);
        this.socket.on(SOCKET_EVENTS.PLAYER_MOVED, this.handlePlayerMoved);
        this.socket.on(SOCKET_EVENTS.COMBAT_STATE, this.handleCombat);
    }

    private detachSocketListeners()
    {
        this.socket.off('connect', this.handleConnect);
        this.socket.off('disconnect', this.handleDisconnect);
        this.socket.off(SOCKET_EVENTS.ROOM_STATE, this.handleRoomState);
        this.socket.off(SOCKET_EVENTS.ROOM_ERROR, this.handleRoomError);
        this.socket.off(SOCKET_EVENTS.PLAYER_JOINED, this.handlePlayerJoined);
        this.socket.off(SOCKET_EVENTS.PLAYER_LEFT, this.handlePlayerLeft);
        this.socket.off(SOCKET_EVENTS.PLAYER_MOVED, this.handlePlayerMoved);
        this.socket.off(SOCKET_EVENTS.COMBAT_STATE, this.handleCombat);
    }

    private joinRoom()
    {
        const payload: JoinRoomPayload = {
            roomId: this.identity.roomId,
            playerName: this.identity.playerName
        };

        this.errorText.setVisible(false);
        this.socket.emit(SOCKET_EVENTS.ROOM_JOIN, payload);
    }

    private readonly handleConnect = () =>
    {
        this.setConnectionStatus('connected');
        this.joinRoom();
    };

    private readonly handleDisconnect = () =>
    {
        this.setConnectionStatus('disconnected');
        this.playerRegistry.replaceAll([]);
        this.selfId = '';
        this.previousInput = '';
        this.mapView?.clear();
        this.bullets?.clear();
        this.syncPlayerViews();
    };

    private readonly handleRoomState = (payload: RoomStatePayload) =>
    {
        this.roomText.setText(`Sala: ${payload.roomId}`);
        this.selfId = payload.selfId;
        this.playerRegistry.replaceAll(payload.players);
        this.mapView?.render(payload.map);
        this.syncPlayerViews();
    };

    private readonly handleRoomError = (payload: RoomErrorPayload) =>
    {
        this.errorText
            .setText(`${payload.code}: ${payload.message}`)
            .setVisible(true);
    };

    private readonly handlePlayerJoined = (payload: PlayerJoinedPayload) =>
    {
        this.playerRegistry.add(payload.player);
        this.upsertPlayerView(payload.player);
        this.updatePlayerCount();
    };

    private readonly handlePlayerMoved = (payload: PlayerMovedPayload) => {
        this.playerRegistry.add(payload.player);
        this.upsertPlayerView(payload.player);
    };

    private readonly pistol = () => { this.weapon = 'pistol'; };
    private readonly machineGun = () => { this.weapon = 'machineGun'; };
    private readonly shotgun = () => { this.weapon = 'shotgun'; };

    private readonly handleCombat = (state: CombatSnapshot) => {
        this.playerRegistry.replaceAll(state.players);
        this.syncPlayerViews();
        const self = state.players.find(player => player.id === this.selfId);
        if (self) this.combatText?.setText(`HP: ${self.hp ?? 100} · Kills: ${self.kills ?? 0} · Deaths: ${self.deaths ?? 0} · ${this.weapon}${self.alive === false ? ' · RESPAWN...' : ''}`);
        this.bullets?.clear();
        this.bullets?.fillStyle(0xfacc15, 1);
        for (const projectile of state.projectiles) this.bullets?.fillCircle(projectile.x, projectile.y, 5);
    };

    update(time: number) {
        if (!this.socket?.connected || !this.selfId || !this.keys || !this.cursors) return;
        const pad = this.input.gamepad?.getPad(0);
        const x = pad?.leftStick.x ?? 0;
        const y = pad?.leftStick.y ?? 0;
        const dashHeld = this.keys.shift.isDown || !!pad?.buttons[5]?.pressed;
        const input: PlayerInput = {
            up: this.keys.w.isDown || this.cursors.up.isDown || y < -0.2 || !!pad?.up,
            down: this.keys.s.isDown || this.cursors.down.isDown || y > 0.2 || !!pad?.down,
            left: this.keys.a.isDown || this.cursors.left.isDown || x < -0.2 || !!pad?.left,
            right: this.keys.d.isDown || this.cursors.right.isDown || x > 0.2 || !!pad?.right,
            dash: dashHeld
        };
        const player = this.playerRegistry.get(this.selfId);
        const pointer = this.input.activePointer;
        const holding = pointer.isDown;
        const cooldown = this.weapon === 'machineGun' ? 100 : this.weapon === 'shotgun' ? 800 : 500;
        if (player && player.alive !== false && holding && time - this.lastShot >= cooldown &&
            (this.weapon === 'machineGun' || !this.fireHeld)) {
            const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            const angle = Math.atan2(point.y - player.y, point.x - player.x);
            this.socket.emit(SOCKET_EVENTS.PLAYER_SHOOT, { weapon: this.weapon, angle });
            this.lastShot = time;
        }
        this.fireHeld = holding;
        const serialized = JSON.stringify(input);
        if (serialized !== this.previousInput || time - this.lastInputSent >= 100) {
            this.socket.emit(SOCKET_EVENTS.PLAYER_INPUT, { input });
            this.previousInput = serialized;
            this.lastInputSent = time;
        }
    }

    private readonly handlePlayerLeft = (payload: PlayerLeftPayload) =>
    {
        this.playerRegistry.remove(payload.playerId);

        const view = this.playerViews.get(payload.playerId);

        if (view)
        {
            view.destroy();
            this.playerViews.delete(payload.playerId);
        }

        this.updatePlayerCount();
    };

    private syncPlayerViews()
    {
        const activeIds = new Set(
            this.playerRegistry.getAll().map((player) => player.id)
        );

        for (const [playerId, view] of this.playerViews)
        {
            if (!activeIds.has(playerId))
            {
                view.destroy();
                this.playerViews.delete(playerId);
            }
        }

        for (const player of this.playerRegistry.getAll())
        {
            this.upsertPlayerView(player);
        }

        this.updatePlayerCount();
    }

    private upsertPlayerView(player: PlayerState)
    {
        const existing = this.playerViews.get(player.id);

        if (existing)
        {
            existing.update(player);
            return;
        }

        const view = new PlayerView(
            this,
            player,
            player.id === this.selfId
        );

        this.playerViews.set(player.id, view);
    }

    private clearPlayerViews()
    {
        for (const view of this.playerViews.values())
        {
            view.destroy();
        }

        this.playerViews.clear();
        this.playerRegistry.replaceAll([]);
    }

    private updatePlayerCount()
    {
        this.playerCountText.setText(`Players: ${this.playerRegistry.size}`);
    }

    private setConnectionStatus(status: ConnectionStatus)
    {
        const labels: Record<ConnectionStatus, string> = {
            connecting: '● CONNECTING',
            connected: '● CONNECTED',
            disconnected: '● DISCONNECTED'
        };

        const colors: Record<ConnectionStatus, string> = {
            connecting: '#facc15',
            connected: '#4ade80',
            disconnected: '#fb7185'
        };

        this.connectionText.setText(labels[status]);
        this.connectionText.setColor(colors[status]);
    }
}
