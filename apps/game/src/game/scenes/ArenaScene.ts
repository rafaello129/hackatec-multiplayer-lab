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
import { Scene, type GameObjects, Input, type Types, type Cameras } from 'phaser';
import type { GameMapState } from '@hackatec/shared';
import type { Socket } from 'socket.io-client';
import { ProfilePanel } from '../ui/ProfilePanel';
import { MapView } from '../map/MapView';
import { PlayerView } from '../entities/PlayerView';
import { getClientIdentity, type ClientIdentity } from '../../network/identity';
import { getSocket } from '../../network/socket';
import { PlayerRegistry } from '../../state/PlayerRegistry';
import { loadArenaSprites, prepareArenaSprites } from '../assets';
import { LessonOverlay } from '../../classroom/LessonOverlay';

export class ArenaScene extends Scene
{
    private socket!: Socket;
    private identity!: ClientIdentity;
    private readonly playerRegistry = new PlayerRegistry();
    private readonly playerViews = new Map<string, PlayerView>();

    private selfId = '';
    private worldCamera!: Cameras.Scene2D.Camera;
    private level?: GameMapState;
    private minimap?: GameObjects.Graphics;
    private lessonOverlay?: LessonOverlay;
    private mapView?: MapView;
    private cursors?: Types.Input.Keyboard.CursorKeys;
    private keys?: { w: Input.Keyboard.Key; a: Input.Keyboard.Key; s: Input.Keyboard.Key; d: Input.Keyboard.Key; shift: Input.Keyboard.Key };
    private previousInput = '';
    private lastInputSent = 0;
    private profilePanel?: ProfilePanel;
    private scoreboard?: GameObjects.Text;
    private healthBar?: GameObjects.Graphics;
    private weapon: WeaponType = 'pistol';
    private lastShot = 0;
    private fireHeld = false;
    private editingProfile = false;
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

    preload()
    {
        loadArenaSprites(this);
    }

    create()
    {
        prepareArenaSprites(this);
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
        this.combatText = this.add.text(355, 66, '', { fontFamily: 'monospace', fontSize: 12, color: '#e7ddc6', lineSpacing: 8 }).setDepth(5);
        this.input.keyboard?.on('keydown-ONE', this.pistol);
        this.input.keyboard?.on('keydown-TWO', this.machineGun);
        this.input.keyboard?.on('keydown-THREE', this.shotgun);
        this.healthBar = this.add.graphics().setDepth(8);
        this.scoreboard = this.add.text(650, 23, '', { fontFamily:'monospace',fontSize:10,color:'#bac9bc',lineSpacing:5 }).setDepth(8);
        this.worldCamera = this.cameras.add(0,155,1024,560).setBackgroundColor('#b88958');
        this.worldCamera.ignore(this.children.list.filter(child => child !== this.mapView?.container && child !== this.bullets));
        this.cameras.main.ignore([this.mapView.container, this.bullets]);
        this.minimap = this.add.graphics().setDepth(10);
        this.worldCamera.ignore(this.minimap);
        this.lessonOverlay = new LessonOverlay(this, this.worldCamera);
        this.profilePanel = new ProfilePanel(
            (username, appearance) => this.socket.emit(SOCKET_EVENTS.PROFILE_SET, { username:username || undefined, appearance }),
            this.handleProfileFocus
        );
        this.profilePanel.setConnected(false);
        this.attachSocketListeners();

        this.events.once('shutdown', () =>
        {
            this.detachSocketListeners();
            this.lessonOverlay?.destroy();
            this.clearPlayerViews();
            this.mapView?.destroy();
            this.profilePanel?.destroy();
            this.handleProfileFocus(false);
            this.input.keyboard?.off('keydown-ONE', this.pistol);
            this.input.keyboard?.off('keydown-TWO', this.machineGun);
            this.input.keyboard?.off('keydown-THREE', this.shotgun);
        });

        if (this.socket.connected)
        {
            this.setConnectionStatus('connected');
            const initialState = this.registry.get('initialRoomState') as RoomStatePayload | undefined;
            this.registry.remove('initialRoomState');
            if (initialState && this.registry.get('initialSocketId') === this.socket.id) this.handleRoomState(initialState);
            else this.joinRoom();
        }
        else
        {
            this.setConnectionStatus('connecting');
            this.socket.connect();
        }
    }

    private createInterface()
    {
        this.cameras.main.setBackgroundColor('#151f20');
        this.add.text(28, 23, 'DUST / ARENA', { fontFamily:'Arial Black', fontSize:30, color:'#f1e5c9' });
        this.roomText = this.add.text(29, 62, 'CAÑÓN ROJO  /  TRES RUTAS', { fontFamily:'monospace', fontSize:11, color:'#9bafa8' });
        this.playerCountText = this.add.text(29, 85, '', {fontFamily:'monospace',fontSize:12,color:'#9bafa8'});
        this.connectionText = this.add.text(994, 129, '', {fontFamily:'monospace',fontSize:11,color:'#a3c8a3'}).setOrigin(1,0);
        this.add.text(29, 129, 'CAMPO ABIERTO  /  TODOS CONTRA TODOS', {fontFamily:'monospace',fontSize:11,color:'#9bafa8'});
        this.errorText = this.add.text(512, 152, '', {fontFamily:'Arial',fontSize:13,color:'#fff0df',backgroundColor:'#813c32',padding:{x:12,y:8}}).setOrigin(0.5).setDepth(20).setVisible(false);
        this.add.text(28, 741, 'WASD  mover     SHIFT  dash     CLIC  disparar     1 / 2 / 3  armas', {fontFamily:'monospace',fontSize:11,color:'#a5b6ad'});
        this.add.text(994, 741, 'HACKATEC  /  MULTIPLAYER', {fontFamily:'monospace',fontSize:10,color:'#73877c'}).setOrigin(1,0);
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
        this.socket.on(SOCKET_EVENTS.PROFILE_RESULT, this.handleProfileResult);
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
        this.socket.off(SOCKET_EVENTS.PROFILE_RESULT, this.handleProfileResult);
    }

    private joinRoom()
    {
        const payload: JoinRoomPayload = {
            roomId: this.identity.roomId,
            playerName: this.identity.playerName,
            profileId: this.identity.profileId
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
        this.lessonOverlay?.reset();
        this.worldCamera.stopFollow();
        this.minimap?.clear();
        this.level = undefined;
        this.profilePanel?.setConnected(false);
        this.playerRegistry.replaceAll([]);
        this.selfId = '';
        this.previousInput = '';
        this.mapView?.clear();
        this.bullets?.clear();
        this.syncPlayerViews();
    };

    private readonly handleRoomState = (payload: RoomStatePayload) =>
    {
        this.lessonOverlay?.reset();
        this.level = payload.map;
        this.worldCamera.setBounds(0,0,payload.map.width,payload.map.height);
        this.selfId = payload.selfId;
        this.profilePanel?.setConnected(true);
        const own = payload.players.find(player => player.id === payload.selfId);
        if (own?.appearance) this.profilePanel?.setProfile(own.name, own.appearance);
        this.playerRegistry.replaceAll(payload.players);
        this.mapView?.render(payload.map);
        this.syncPlayerViews();
        // Recovery may deliver combat snapshots before room:state, creating the
        // view before selfId is known. Bind follow after identity is established.
        const ownView = this.playerViews.get(this.selfId);
        if (own && ownView) {
            this.worldCamera.startFollow(ownView.container, true, 0.15, 0.15);
            this.worldCamera.centerOn(own.x,own.y);
        }
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

    private readonly handleProfileResult = (result: {ok:boolean;message:string}) => {
        this.profilePanel?.setResult(result.message);
        if (!result.ok) this.errorText.setText(result.message).setVisible(true);
        else this.errorText.setVisible(false);
    };

    private readonly handleProfileFocus = (focused: boolean) => {
        this.editingProfile = focused;
        const keyboard = this.input.keyboard;
        if (keyboard) {
            keyboard.resetKeys();
            keyboard.enabled = !focused;
            if (focused) keyboard.disableGlobalCapture();
            else keyboard.enableGlobalCapture();
        }
        this.fireHeld = false;
    };

    private readonly handleCombat = (state: CombatSnapshot) => {
        this.playerRegistry.replaceAll(state.players);
        this.syncPlayerViews();
        const self = state.players.find(player => player.id === this.selfId);
        this.scoreboard?.setText('LÍDERES                   B / M\n' + [...state.players].sort((a,b)=>(b.kills??0)-(a.kills??0)).slice(0,3).map((p,i)=>`${i+1}. ${p.name}: ${p.kills??0} / ${p.deaths??0}`).join('\n'));
        this.healthBar?.clear();
        if (self) {
            this.healthBar?.fillStyle(0x334155).fillRect(355, 37, 260, 8);
            this.healthBar?.fillStyle((self.hp??100)>30 ? 0x22c55e : 0xef4444).fillRect(355,37,260*Math.max(0,Math.min(100,self.hp??100))/100,8);
        }
        if (self) this.combatText?.setText(`VIDA ${self.hp ?? 100}     BAJAS ${self.kills ?? 0} / ${self.deaths ?? 0}\n${({pistol: '[1] PISTOLA', machineGun: '[2] AMETRALLADORA', shotgun: '[3] ESCOPETA'})[this.weapon]}${self.alive === false ? ' · REAPARECIENDO…' : ''}`);
        this.bullets?.clear();
        this.bullets?.fillStyle(0xfacc15, 1);
        for (const projectile of state.projectiles) this.bullets?.fillCircle(projectile.x, projectile.y, 5);
    };

    update(time: number, delta: number) {
        this.updateNavigation();
        if (this.level && this.selfId) {
            const pointer = this.input.activePointer;
            const overField = pointer.x >= 0 && pointer.x <= 1024 && pointer.y > 155 && pointer.y < 715;
            this.lessonOverlay?.update({
                time, delta, selfId: this.selfId, players: this.playerRegistry.getAll(),
                map: this.level, weapon: this.weapon, editingProfile: this.editingProfile,
                pointer: overField && !this.editingProfile ? this.worldCamera.getWorldPoint(pointer.x, pointer.y) : null
            });
        }
        if (!this.socket?.connected || !this.selfId || !this.keys || !this.cursors) return;
        if (this.editingProfile) {
            const input: PlayerInput = { up:false, down:false, left:false, right:false, dash:false };
            const serialized = JSON.stringify(input);
            if (serialized !== this.previousInput) {
                this.socket.emit(SOCKET_EVENTS.PLAYER_INPUT, { input });
                this.previousInput = serialized;
            }
            this.fireHeld = false;
            return;
        }
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
        const holding = pointer.isDown && pointer.downElement === this.game.canvas &&
            pointer.x >= 0 && pointer.x <= 1024 && pointer.y > 155 && pointer.y < 715;
        const cooldown = this.weapon === 'machineGun' ? 100 : this.weapon === 'shotgun' ? 800 : 500;
        if (player && player.alive !== false && holding && time - this.lastShot >= cooldown &&
            (this.weapon === 'machineGun' || !this.fireHeld)) {
            const point = this.worldCamera.getWorldPoint(pointer.x, pointer.y);
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
        view.container.setDepth(1);
        this.cameras.main.ignore(view.container);
        if (player.id === this.selfId) this.worldCamera.startFollow(view.container, true, 0.15, 0.15);
    }

    private updateNavigation(): void {
        const map=this.level,self=this.playerRegistry.get(this.selfId),g=this.minimap;
        if(!map||!self||!g) return;
        const zone=map.zones?.find(z=>self.x>=z.x&&self.x<z.x+z.width&&self.y>=z.y&&self.y<z.y+z.height);
        this.roomText.setText(zone?.name ?? 'CAÑÓN ROJO');
        const x=856,y=20,w=144,h=96,sx=w/map.width,sy=h/map.height;
        g.clear().fillStyle(0x0c1714,0.95).fillRect(x-4,y-4,w+8,h+8);
        g.fillStyle(0xb88958).fillRect(x,y,w,h);
        g.fillStyle(0x78442d);
        for(const obstacle of map.obstacles) if(obstacle.type==='wall') {
            g.fillRect(x+(obstacle.x-obstacle.width/2)*sx,y+(obstacle.y-obstacle.height/2)*sy,obstacle.width*sx,obstacle.height*sy);
        }
        for(const obstacle of map.obstacles) {
            if(obstacle.type==='cactus') {
                g.fillStyle(0x24572b).fillCircle(x+obstacle.x*sx,y+obstacle.y*sy,1.6);
            } else if(obstacle.type==='trap') {
                g.lineStyle(2,0x704020).lineBetween(x+(obstacle.x-obstacle.width/2)*sx,y+obstacle.y*sy,x+(obstacle.x+obstacle.width/2)*sx,y+obstacle.y*sy);
            }
        }
        g.lineStyle(1,0xf5e4b6,0.6).strokeRect(x+this.worldCamera.scrollX*sx,y+this.worldCamera.scrollY*sy,1024*sx,560*sy);
        g.fillStyle(0xd5ed8b).fillCircle(x+self.x*sx,y+self.y*sy,3);
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
        this.playerCountText.setText(`${this.playerRegistry.size} PILOTOS EN EL CAMPO`);
    }

    private setConnectionStatus(status: ConnectionStatus)
    {
        const labels: Record<ConnectionStatus, string> = {
            connecting: '● CONECTANDO',
            connected: '● EN LÍNEA',
            disconnected: '● RECONECTANDO'
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
