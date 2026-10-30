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
    type RoomStatePayload,
    type MatchStatePayload,
    type GameMapState,
    MATCH_TEXTS
} from '@hackatec/shared';
import { Scene, type GameObjects, Input } from 'phaser';
import type { Socket } from 'socket.io-client';
import { ProfilePanel } from '../ui/ProfilePanel';
import { MapView } from '../map/MapView';
import { PlayerView } from '../entities/PlayerView';
import { getClientIdentity, type ClientIdentity } from '../../network/identity';
import { getSocket } from '../../network/socket';
import { PlayerRegistry } from '../../state/PlayerRegistry';

export class ArenaScene extends Scene
{
    private timeRemaining: number = 300;
    private timerText!: Phaser.GameObjects.Text;
    private gameTimer?: Phaser.Time.TimerEvent;
    private currentMode: string = 'normal';
    private playerTeam: 'none' | 'red' | 'blue' = 'none';
    private zombieGroup!: Phaser.Physics.Arcade.Group;
    private zombieSpawnTimer?: Phaser.Time.TimerEvent;
    private socket!: Socket;
    private identity!: ClientIdentity;
    private readonly playerRegistry = new PlayerRegistry();
    private readonly playerViews = new Map<string, PlayerView>();
    private selfId = '';
    private roomHostId = '';
    private mapView?: MapView;
    private keys?: { w: Input.Keyboard.Key; a: Input.Keyboard.Key; s: Input.Keyboard.Key; d: Input.Keyboard.Key; shift: Input.Keyboard.Key };
    private previousInput = '';
    private lastInputSent = 0;
    private profilePanel?: ProfilePanel;
    private scoreboard?: GameObjects.Text;
    private healthBar?: GameObjects.Graphics;
    private weapon: WeaponType = 'pistol';
    private lastShot = 0;
    private fireHeld = false;
    private bullets?: GameObjects.Graphics;
    private combatText?: GameObjects.Text;
    private matchState?: MatchStatePayload;
    private matchStatusText?: GameObjects.Text;
    private voteButton?: GameObjects.Text;
    private hostMenuButton?: GameObjects.Text;
    private hostStartButton?: GameObjects.Text;
    private hostStopButton?: GameObjects.Text;
    private matchCountdownText?: GameObjects.Text;

    private roomText!: GameObjects.Text;
    private playerCountText!: GameObjects.Text;
    private connectionText!: GameObjects.Text;
    private errorText!: GameObjects.Text;

    // --- NUEVAS PROPIEDADES PARA CONTROLES Y DASH ---
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: {
        up: Input.Keyboard.Key;
        down: Input.Keyboard.Key;
        left: Input.Keyboard.Key;
        right: Input.Keyboard.Key;
    };
    
    private shiftKey!: Input.Keyboard.Key;
    private localX: number = 512;
    private localY: number = 438;
    private lastDashTime: number = 0;
    private dashCooldown: number = 4000; // 4 segundos en milisegundos
    private playerSpeed: number = 5;
    private isInvulnerable: boolean = false;
    private mapWidth: number = 960;  // Ancho basado en el rectángulo de juego original
    private mapHeight: number = 600; // Alto basado en el rectángulo de juego original
    private playerRadius: number = 20;

    constructor()
    {
        super('ArenaScene');
    }
   
  
    public create(): void {
        this.cameras.main.setBackgroundColor('#07111f');

        this.identity = getClientIdentity(window.location.search);
        this.socket = getSocket();

        this.zombieGroup = this.physics.add.group({ maxSize: 100 });
        this.createInterface();
        this.mapView = new MapView(this);
        this.bullets = this.add.graphics().setDepth(3);
        this.combatText = this.add.text(36, 105, '', { fontFamily: 'Arial', fontSize: 15, color: '#f8fafc' }).setDepth(5);
        this.input.keyboard?.on('keydown-ONE', this.pistol);
        this.input.keyboard?.on('keydown-TWO', this.machineGun);
        this.input.keyboard?.on('keydown-THREE', this.shotgun);
        this.healthBar = this.add.graphics().setDepth(8);
        this.scoreboard = this.add.text(765, 390, '', { fontFamily:'Arial',fontSize:14,color:'#f8fafc',backgroundColor:'#0f172acc',padding:{x:10,y:8} }).setDepth(8);
        this.profilePanel = new ProfilePanel((username, appearance) => this.socket.emit(SOCKET_EVENTS.PROFILE_SET, { username: username || undefined, appearance }));
        this.attachSocketListeners();

        // --- INICIALIZAR TECLADO GLOBALMENTE ---
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = {
                up: this.input.keyboard.addKey(Input.Keyboard.KeyCodes.W),
                down: this.input.keyboard.addKey(Input.Keyboard.KeyCodes.S),
                left: this.input.keyboard.addKey(Input.Keyboard.KeyCodes.A),
                right: this.input.keyboard.addKey(Input.Keyboard.KeyCodes.D),
            };
            this.shiftKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.SHIFT);
            this.input.keyboard.enabled = true;
        }

        this.events.once('shutdown', () => {
            this.detachSocketListeners();
            this.clearPlayerViews();
            this.mapView?.destroy();
            this.profilePanel?.destroy();
            this.input.keyboard?.off('keydown-ONE', this.pistol);
            this.input.keyboard?.off('keydown-TWO', this.machineGun);
            this.input.keyboard?.off('keydown-THREE', this.shotgun);
        });

        if (this.socket.connected) {
            this.setConnectionStatus('connected');
            this.joinRoom();
        } else {
            this.setConnectionStatus('connecting');
            this.socket.connect();
        }

        this.createMatchInterface();

        this.events.once('shutdown', () => {
            this.matchStatusText?.destroy();
            this.voteButton?.destroy();
            this.hostMenuButton?.destroy();
            this.hostStartButton?.destroy();
            this.hostStopButton?.destroy();
            this.matchCountdownText?.destroy();
        });
    }

    private createMatchInterface(): void {
        this.matchStatusText = this.add.text(512, 142, 'Esperando jugadores…', {
            fontFamily: 'Arial Black', fontSize: 17, color: '#f8fafc',
            backgroundColor: '#0f172acc', padding: { x: 12, y: 7 }, align: 'center'
        }).setOrigin(0.5).setDepth(320);

        this.matchCountdownText = this.add.text(512, 178, '', {
            fontFamily: 'Arial Black', fontSize: 20, color: '#facc15',
            backgroundColor: '#0f172acc', padding: { x: 10, y: 5 }, align: 'center'
        }).setOrigin(0.5).setDepth(320);

        this.voteButton = this.add.text(512, 220, MATCH_TEXTS.controls.voteClassic, {
            fontFamily: 'Arial Black', fontSize: 16, color: '#ffffff',
            backgroundColor: '#0369a1', padding: { x: 14, y: 8 }
        }).setOrigin(0.5).setDepth(321).setInteractive().setVisible(false);
        this.voteButton.on('pointerdown', () => this.socket.emit(SOCKET_EVENTS.MATCH_VOTE, { mode: 'classic' }));

        this.hostMenuButton = this.add.text(870, 112, MATCH_TEXTS.controls.hostMenu, {
            fontFamily: 'Arial Black', fontSize: 14, color: '#facc15',
            backgroundColor: '#1e293b', padding: { x: 10, y: 7 }
        }).setOrigin(0.5).setDepth(321).setInteractive().setVisible(false);
        this.hostMenuButton.on('pointerdown', () => {
            const visible = !this.hostStartButton?.visible;
            this.hostStartButton?.setVisible(visible);
            this.hostStopButton?.setVisible(visible);
        });

        this.hostStartButton = this.add.text(870, 158, MATCH_TEXTS.controls.hostStart, {
            fontFamily: 'Arial', fontSize: 13, color: '#ffffff',
            backgroundColor: '#166534', padding: { x: 9, y: 6 }
        }).setOrigin(0.5).setDepth(321).setInteractive().setVisible(false);
        this.hostStartButton.on('pointerdown', () => this.socket.emit(SOCKET_EVENTS.MATCH_HOST_START, { mode: 'classic' }));

        this.hostStopButton = this.add.text(870, 198, MATCH_TEXTS.controls.hostStop, {
            fontFamily: 'Arial', fontSize: 13, color: '#ffffff',
            backgroundColor: '#991b1b', padding: { x: 9, y: 6 }
        }).setOrigin(0.5).setDepth(321).setInteractive().setVisible(false);
        this.hostStopButton.on('pointerdown', () => {
            this.socket.emit(SOCKET_EVENTS.MATCH_HOST_STOP);
            this.hostStartButton?.setVisible(false);
            this.hostStopButton?.setVisible(false);
        });
    }

    private readonly handleMatchState = (state: MatchStatePayload): void => {
        this.matchState = state;
        this.roomHostId = state.hostId ?? '';
        const labels: Record<MatchStatePayload['phase'], string> = {
            waiting: MATCH_TEXTS.phases.waiting,
            voting: MATCH_TEXTS.phases.voting,
            countdown: MATCH_TEXTS.phases.countdown,
            playing: MATCH_TEXTS.phases.playing,
            results: MATCH_TEXTS.phases.results
        };
        const voteCount = Object.keys(state.votes).length;
        const host = this.roomHostId === this.selfId;
        this.matchStatusText?.setText(state.message ? labels[state.phase] + '\\n' + state.message : labels[state.phase]);
        this.voteButton?.setVisible(state.phase === 'voting');
        this.voteButton?.setText(state.votes[this.selfId] ? MATCH_TEXTS.controls.changeVoteClassic : 'Votar: Clásico');
        this.hostMenuButton?.setVisible(host);
        if (!host) {
            this.hostStartButton?.setVisible(false);
            this.hostStopButton?.setVisible(false);
        }
        if (state.phase === 'voting') {
            this.matchStatusText?.setText(labels[state.phase] + ' · ' + voteCount + ' voto(s)');
        } else if (state.phase === 'results' && state.results.length > 0) {
            const lines = state.results.slice(0, 5).map((result, index) => `${index + 1}. ${result.name}: ${result.kills} bajas / ${result.deaths} muertes`);
            this.scoreboard?.setText('RESULTADOS\\n' + lines.join('\\n'));
            this.matchStatusText?.setText(labels[state.phase]);
        }
        this.updateMatchClock();
    };

    private readonly handleRoomMap = (map: GameMapState): void => {
        this.mapView?.render(map);
    };

    private readonly handleHostChanged = (payload: { hostId: string }): void => {
        this.roomHostId = payload.hostId;
        const isHost = this.roomHostId === this.selfId;
        this.hostMenuButton?.setVisible(isHost);
        if (!isHost) { this.hostStartButton?.setVisible(false); this.hostStopButton?.setVisible(false); }
    };

    private readonly handleMatchActionResult = (result: { ok: boolean; message: string }): void => {
        if (!result.ok) this.errorText.setText(result.message).setVisible(true);
        else this.errorText.setVisible(false);
    };

    private updateMatchClock(): void {
        const state = this.matchState;
        if (!state || !this.matchCountdownText) return;
        const target = state.phase === 'voting' ? state.voteEndsAt :
            state.phase === 'countdown' ? state.startsAt :
            state.phase === 'playing' || state.phase === 'results' ? state.endsAt : null;
        if (target === null) {
            this.matchCountdownText.setText('');
            return;
        }
        const seconds = Math.max(0, Math.ceil((target - Date.now()) / 1000));
        const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
        const remainder = (seconds % 60).toString().padStart(2, '0');
        const prefix = state.phase === 'voting' ? 'Votación: ' :
            state.phase === 'countdown' ? 'Inicio: ' :
            state.phase === 'results' ? 'Resultados: ' : 'Tiempo: ';
        this.matchCountdownText.setText(prefix + minutes + ':' + remainder);
    }

    private spawnZombieBot(): void {

    // Distancia mínima y máxima del jugador
    const minDistance = 250;
    const maxDistance = 450;

    // Ángulo aleatorio alrededor del jugador
    const angle = Math.random() * Math.PI * 2;

    // Distancia aleatoria
    const distance =
        minDistance + Math.random() * (maxDistance - minDistance);

    // Posición aleatoria alrededor del jugador
    const spawnX = this.localX + Math.cos(angle) * distance;
    const spawnY = this.localY + Math.sin(angle) * distance;

    const zombie = this.zombieGroup.create(
        spawnX,
        spawnY,
        'zombie_bot_skin'
    ) as Phaser.Physics.Arcade.Sprite;

    zombie.setAlpha(1);
    zombie.setScale(2);
    zombie.setPosition(spawnX, spawnY);
    zombie.setDepth(100);
    zombie.setVisible(true);
    zombie.setActive(true);
    zombie.setCollideWorldBounds(true);

    console.log('Zombi creado:', {
        x: zombie.x,
        y: zombie.y,
        total: this.zombieGroup.countActive()
    });
}

private startZombieSpawner(): void {
    if (this.zombieSpawnTimer) {
        this.zombieSpawnTimer.remove(false);
    }

    const spawnNextZombie = () => {

        // Máximo 30 zombis activos
        const activeZombies = this.zombieGroup
            ? this.zombieGroup.getChildren().filter(
                child => child.active
            ).length
            : 0;

        if (activeZombies < 30 && this.currentMode === 'zombie') {
            this.spawnZombieBot();
        }

        // Tiempo transcurrido
        const elapsed = 300 - this.timeRemaining;

        // Cooldown según el tiempo de partida
        let cooldown = 1000;

        if (elapsed >= 240) {
            cooldown = 250;
        } else if (elapsed >= 180) {
            cooldown = 350;
        } else if (elapsed >= 120) {
            cooldown = 500;
        } else if (elapsed >= 60) {
            cooldown = 750;
        }

        // Programar el siguiente zombi
        if (this.currentMode === 'zombie') {
            this.zombieSpawnTimer = this.time.delayedCall(
                cooldown,
                spawnNextZombie
            );
        }
    };

    // Primer zombi
    spawnNextZombie();
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
        this.socket.on(SOCKET_EVENTS.PROFILE_RESULT, this.handleProfileResult);
        this.socket.on(SOCKET_EVENTS.MATCH_STATE, this.handleMatchState);
        this.socket.on(SOCKET_EVENTS.ROOM_MAP, this.handleRoomMap);
        this.socket.on(SOCKET_EVENTS.MATCH_ACTION_RESULT, this.handleMatchActionResult);
        this.socket.on(SOCKET_EVENTS.ROOM_HOST_CHANGED, this.handleHostChanged);
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
        this.socket.off(SOCKET_EVENTS.MATCH_STATE, this.handleMatchState);
        this.socket.off(SOCKET_EVENTS.ROOM_MAP, this.handleRoomMap);
        this.socket.off(SOCKET_EVENTS.MATCH_ACTION_RESULT, this.handleMatchActionResult);
        this.socket.off(SOCKET_EVENTS.ROOM_HOST_CHANGED, this.handleHostChanged);
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
        this.playerRegistry.replaceAll([]);
        this.selfId = '';
        this.matchState = undefined;
        this.roomHostId = '';
        this.previousInput = '';
        this.mapView?.clear();
        this.bullets?.clear();
        this.syncPlayerViews();
    };

   // === 2. REEMPLAZA TU handleRoomState COMPLETO POR ESTE ===
    private readonly handleRoomState = (payload: RoomStatePayload) =>
    {
        this.roomText.setText(`Sala: ${payload.roomId}`);
        this.selfId = payload.selfId;
        const own = payload.players.find(player => player.id === payload.selfId);
        if (own?.appearance) this.profilePanel?.setProfile(own.name, own.appearance);
        this.playerRegistry.replaceAll(payload.players);
        this.mapView?.render(payload.map);
        this.syncPlayerViews();
        if (payload.hostId) this.roomHostId = payload.hostId;

        const myPlayerState = this.playerRegistry.get(this.selfId);
        if (myPlayerState) {
            if (myPlayerState.x) this.localX = myPlayerState.x;
            if (myPlayerState.y) this.localY = myPlayerState.y;
            this.upsertPlayerView(myPlayerState);
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
        if (!result.ok) this.errorText.setText(result.message).setVisible(true);
        else this.errorText.setVisible(false);
    };

    private readonly handleCombat = (state: CombatSnapshot) => {
        this.playerRegistry.replaceAll(state.players);
        this.syncPlayerViews();
        const self = state.players.find(player => player.id === this.selfId);
        this.scoreboard?.setText('CLASIFICACIÓN\n' + [...state.players].sort((a,b)=>(b.kills??0)-(a.kills??0)).slice(0,8).map((p,i)=>`${i+1}. ${p.name}: ${p.kills??0} / ${p.deaths??0}`).join('\n'));
        this.healthBar?.clear();
        if (self) {
            this.healthBar?.fillStyle(0x334155).fillRect(36, 127, 220, 12);
            this.healthBar?.fillStyle((self.hp??100)>30 ? 0x22c55e : 0xef4444).fillRect(36,127,220*Math.max(0,Math.min(100,self.hp??100))/100,12);
        }
        if (self) this.combatText?.setText(self.spectator ? MATCH_TEXTS.controls.spectator : `HP: ${self.hp ?? 100} · Kills: ${self.kills ?? 0} · Deaths: ${self.deaths ?? 0} · ${this.weapon}${self.alive === false ? ' · RESPAWN...' : ''}`);
        this.bullets?.clear();
        this.bullets?.fillStyle(0xfacc15, 1);
        for (const projectile of state.projectiles) this.bullets?.fillCircle(projectile.x, projectile.y, 5);
    };

    update(time: number) {
        this.updateMatchClock();
        if (!this.socket?.connected || !this.selfId || !this.keys || !this.cursors || this.matchState?.phase !== 'playing' || this.playerRegistry.get(this.selfId)?.spectator) return;
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
        const holding = pointer.isDown && pointer.x < 765 && pointer.y > 155 && pointer.y < 715;
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
} // <-- Esta es la llave final que cierra la clase ArenaScene
