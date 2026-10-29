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

        this.cursors = this.input.keyboard?.createCursorKeys();
        if (this.input.keyboard) {
            const k = Input.Keyboard.KeyCodes;
            this.keys = { w: this.input.keyboard.addKey(k.W), a: this.input.keyboard.addKey(k.A), s: this.input.keyboard.addKey(k.S), d: this.input.keyboard.addKey(k.D), shift: this.input.keyboard.addKey(k.SHIFT) };
        }
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
        this.profilePanel = new ProfilePanel((username, appearance) => this.socket.emit(SOCKET_EVENTS.PROFILE_SET, { username:username || undefined, appearance }));
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

        // --- REFERENCIA FIJA A LA ESCENA ---
        const mainScene = this;

        // --- 1. REGISTRO DE TEXTURA ZOMBI BOT ---
        if (!mainScene.textures.exists('zombie_bot_skin')) {
            const zG = mainScene.make.graphics({ x: 0, y: 0 }, false);
            zG.fillStyle(0x10b981, 1);
            zG.fillRect(0, 0, 32, 32);
            zG.lineStyle(3, 0x065f46, 1);
            zG.strokeRect(0, 0, 32, 32);
            zG.generateTexture('zombie_bot_skin', 32, 32);
            zG.destroy();
        }

        // --- 2. TEMPORIZADOR GLOBAL (Justo abajo de Players: 1 en X: 512, Y: 78) ---
        if (!mainScene.gameTimer) {
            mainScene.timeRemaining = 300;
            mainScene.timerText = mainScene.add.text(512, 78, 'Tiempo: 05:00', {
                fontFamily: 'Arial Black',
                fontSize: 18,
                color: '#facc15'
            }).setOrigin(0.5, 0.5).setDepth(300);

            mainScene.gameTimer = mainScene.time.addEvent({
                delay: 1000,
                callback: () => {
                    if (mainScene.timeRemaining > 0) {
                        mainScene.timeRemaining--;
                        const minutes = Math.floor(mainScene.timeRemaining / 60);
                        const seconds = mainScene.timeRemaining % 60;
                        const fm = minutes.toString().padStart(2, '0');
                        const fs = seconds.toString().padStart(2, '0');
                        mainScene.timerText.setText(`Tiempo: ${fm}:${fs}`);
                    } else {
                        mainScene.timerText.setText('Tiempo: 00:00');
                    }
                },
                callbackScope: mainScene,
                loop: true
            });
        }

        // --- 3. BOTÓN MENÚ MODOS (En X: 700, Y: 47, espacio perfecto entre Players y Connected) ---
        const menuButton = mainScene.add.text(700, 47, '⚙️ Menú Modos', {
            fontSize: 16,
            fontFamily: 'Arial Black',
            backgroundColor: '#0f172a',
            color: '#facc15',
            padding: { x: 14, y: 8 }
        }).setOrigin(0.5, 0.5).setInteractive().setDepth(300).setVisible(false);

        const resetTimer = () => {
            mainScene.timeRemaining = 300;
            if (mainScene.timerText) {
                mainScene.timerText.setText('Tiempo: 05:00');
            }
        };

        // --- 4. CONSTRUCTOR DEL MENÚ DE JUEGO ---
        const createGameMenu = () => {
            const bg = mainScene.add.rectangle(512, 384, 1024, 768, 0x000000, 0.85).setDepth(400);

            const title = mainScene.add.text(512, 180, 'SELECCIONA EL MODO DE JUEGO', {
                fontFamily: 'Arial Black',
                fontSize: 28,
                color: '#ffffff'
            }).setOrigin(0.5).setDepth(401);

            const btnNormal = mainScene.add.text(512, 270, ' Modo Normal (Clásico) ', {
                fontSize: 22,
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setInteractive().setDepth(401);

            const btnTeam = mainScene.add.text(512, 350, ' Modo Equipos (Team) ', {
                fontSize: 22,
                backgroundColor: '#1e293b',
                color: '#4ade80',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setInteractive().setDepth(401);

            const btnZombie = mainScene.add.text(512, 430, ' Modo Zombis (Bots) ', {
                fontSize: 22,
                backgroundColor: '#1e293b',
                color: '#f87171',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setInteractive().setDepth(401);

            let btnRed: Phaser.GameObjects.Text;
            let btnBlue: Phaser.GameObjects.Text;

            const destroyMenu = () => {
                bg.destroy();
                title.destroy();
                btnNormal.destroy();
                btnTeam.destroy();
                btnZombie.destroy();
                if (btnRed) btnRed.destroy();
                if (btnBlue) btnBlue.destroy();
                menuButton.setVisible(true);
            };

            btnNormal.on('pointerdown', () => {
                if (mainScene.currentMode !== 'normal') {
                    resetTimer();
                }
                mainScene.currentMode = 'normal';
                mainScene.playerTeam = 'none';
                mainScene.zombieGroup?.clear(true, true);
                destroyMenu();
                console.log("Modo Normal activo");
            });

            btnTeam.on('pointerdown', () => {
                const prevMode = mainScene.currentMode;
                mainScene.currentMode = 'team';
                
                if (prevMode !== 'team') {
                    resetTimer();
                }

                title.setText('ELIGE TU EQUIPO');
                btnNormal.setVisible(false);
                btnTeam.setVisible(false);
                btnZombie.setVisible(false);

                btnRed = mainScene.add.text(512, 310, ' 🔴 Equipo Rojo ', {
                    fontSize: 22,
                    backgroundColor: '#7f1d1d',
                    color: '#fca5a5',
                    padding: { x: 20, y: 10 }
                }).setOrigin(0.5).setInteractive().setDepth(401);

                btnBlue = mainScene.add.text(512, 400, ' 🔵 Equipo Azul ', {
                    fontSize: 22,
                    backgroundColor: '#1e3a8a',
                    color: '#93c5fd',
                    padding: { x: 20, y: 10 }
                }).setOrigin(0.5).setInteractive().setDepth(401);

                btnRed.on('pointerdown', () => {
                    mainScene.playerTeam = 'red';
                    mainScene.zombieGroup?.clear(true, true);
                    destroyMenu();
                    console.log("Modo Equipo activo - Bando: ROJO");
                });

                btnBlue.on('pointerdown', () => {
                    mainScene.playerTeam = 'blue';
                    mainScene.zombieGroup?.clear(true, true);
                    destroyMenu();
                    console.log("Modo Equipo activo - Bando: AZUL");
                });
            });

           btnZombie.on('pointerdown', () => {
                if (mainScene.currentMode !== 'zombie') {
                    resetTimer();
                }
                mainScene.currentMode = 'zombie';
                mainScene.playerTeam = 'none';
                destroyMenu();

                console.log("Modo Zombis activo");

                // Llamada segura utilizando la referencia fija a la escena
                mainScene.startZombieSpawner();
            });
        };

        menuButton.on('pointerdown', () => {
            menuButton.setVisible(false);
            createGameMenu();
        });

        // Desplegar menú al inicio
        createGameMenu();
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

    

    // --- BUCLE DE ACTUALIZACIÓN DEL JUEGO (INPUT Y MOVIMIENTO) ---
    public update(time: number, delta: number): void {
        if (!this.selfId) return;

        const selfView = this.playerViews.get(this.selfId);
        if (!selfView) return;

        // --- EMOTES ---
        if (this.input.keyboard) {

            // C = Giro 360°
            if (Input.Keyboard.JustDown(
                this.input.keyboard.addKey(Input.Keyboard.KeyCodes.C)
            )) {
                selfView.playSpin();
            }

            // V = Salto
            if (Input.Keyboard.JustDown(
                this.input.keyboard.addKey(Input.Keyboard.KeyCodes.V)
            )) {
                selfView.playJump();
            }

            // B = Agacharse
            if (Input.Keyboard.JustDown(
                this.input.keyboard.addKey(Input.Keyboard.KeyCodes.B)
            )) {
                selfView.playCrouch();
            }

            // N = Sacudida
            if (Input.Keyboard.JustDown(
                this.input.keyboard.addKey(Input.Keyboard.KeyCodes.N)
            )) {
                selfView.playShake();
            }
        }

        const input: PlayerInput = {
            up: this.cursors.up.isDown || this.wasd.up.isDown,
            down: this.cursors.down.isDown || this.wasd.down.isDown,
            left: this.cursors.left.isDown || this.wasd.left.isDown,
            right: this.cursors.right.isDown || this.wasd.right.isDown,
            shift: Input.Keyboard.JustDown(this.shiftKey),
        };

        this.processMovementAndDash(input, selfView);

        // --- MOVIMIENTO DE TODOS LOS ZOMBIS ---
if (this.currentMode === 'zombie' && this.zombieGroup) {

    this.zombieGroup.children.forEach((child: Phaser.GameObjects.GameObject) => {

        const zombie = child as Phaser.Physics.Arcade.Sprite;

        if (!zombie.active) {
            return true;
        }

        const dx = this.localX - zombie.x;
        const dy = this.localY - zombie.y;

        const distance = Math.hypot(dx, dy);

        if (distance > 1) {
            this.physics.moveTo(
                zombie,
                this.localX,
                this.localY,
                140
            );
        } else {
            zombie.setVelocity(0, 0);
        }

        if (!this.isInvulnerable && distance < 35) {
            console.log("¡Contacto con Zombi!");
        }

        return true;
    });
}
    } // <-- Cierra el método update()

    // === 3. REEMPLAZA TU processMovementAndDash COMPLETO POR ESTE ===
    private processMovementAndDash(input: PlayerInput, selfView: PlayerView): void {
       
        let vx = 0;
        let vy = 0;

        if (input.up) vy -= 1;
        if (input.down) vy += 1;
        if (input.left) vx -= 1;
        if (input.right) vx += 1; // <--- AQUÍ: Debe sumar (+1) para ir a la derecha

        if (vx !== 0 && vy !== 0) {
            const normalizationFactor = 1 / Math.sqrt(2);
            vx *= normalizationFactor;
            vy *= normalizationFactor;
        }

        // --- VALIDAR SHIFT, INVULNERABILIDAD Y COOLDOWN DE 2.5 SEGUNDOS ---
        const now = Date.now();
        if (input.shift && !this.isInvulnerable && (now - this.lastDashTime >= this.dashCooldown)) {
            this.lastDashTime = now;
            this.triggerDashInvulnerability();
        }

        // Velocidad multiplicada por 1.5 si está activo el dash/invulnerabilidad
        const currentSpeed = this.isInvulnerable ? this.playerSpeed * 1.5 : this.playerSpeed;

        this.localX += vx * currentSpeed;
        this.localY += vy * currentSpeed;

        const safeMapWidth = this.mapWidth || 960;
        const safeMapHeight = this.mapHeight || 600;

        const minX = 512 - (safeMapWidth / 2) + this.playerRadius;
        const maxX = 512 + (safeMapWidth / 2) - this.playerRadius;
        const minY = 438 - (safeMapHeight / 2) + this.playerRadius;
        const maxY = 438 + (safeMapHeight / 2) - this.playerRadius;

        // Clamp correcto
        this.localX = Math.min(maxX, Math.max(minX, this.localX));
        this.localY = Math.min(maxY, Math.max(minY, this.localY));

        selfView.update({
            id: this.selfId,
            name: this.identity.playerName ?? 'Jugador',
            x: this.localX,
            y: this.localY,
            isInvulnerable: this.isInvulnerable,
            velocity: { x: vx * currentSpeed, y: vy * currentSpeed },
            angle: 0,
            hp: 100,
            maxHp: 100
        } as any);

        // Forzar color visual (magenta para dash, cian normal)
        const container = (selfView as any).container || (selfView as any);
        if (container && container.list) {
            container.list.forEach((child: any) => {
                if (child.setType || child.geom || child.isFilled !== undefined) {
                    child.isFilled = true;
                    child.fillColor = this.isInvulnerable ? 0xff00ff : 0x00ffff; 
                }
            });
        }
        if ((selfView as any).setTint) {
            (selfView as any).setTint(this.isInvulnerable ? 0xff00ff : 0x00ffff);
        }

        if (this.socket && this.socket.connected) {
            this.socket.emit('player:movement', {
                x: this.localX,
                y: this.localY,
                isInvulnerable: this.isInvulnerable,
            });
        }
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
        this.playerRegistry.replaceAll([]);
        this.selfId = '';
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
