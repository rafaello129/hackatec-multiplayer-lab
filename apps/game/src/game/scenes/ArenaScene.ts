import {
    SOCKET_EVENTS,
    type ConnectionStatus,
    type JoinRoomPayload,
    type PlayerJoinedPayload,
    type PlayerLeftPayload,
    type PlayerState,
    type RoomErrorPayload,
    type RoomStatePayload,
    type PlayerInput
} from '@hackatec/shared';
import { Scene, type GameObjects, Input } from 'phaser';
import type { Socket } from 'socket.io-client';
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

    create()
    {
        if (this.input.gamepad) {
        this.input.gamepad.once('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
            console.log('¡Mando conectado!', pad.id);
        });
    }
        this.cameras.main.setBackgroundColor('#07111f');

        this.identity = getClientIdentity(window.location.search);
        this.socket = getSocket();

        this.createInterface();
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

        this.events.once('shutdown', () =>
        {
            this.detachSocketListeners();
            this.clearPlayerViews();
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

        this.add.text(988, 68, 'Presencia sincronizada · movimiento activo', {
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

        this.add.text(512, 730, 'Usa WASD para moverte y SHIFT para dash de invulnerabilidad.', {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#64748b'
        }).setOrigin(0.5);
    }

  // --- BUCLE DE ACTUALIZACIÓN DEL JUEGO (INPUT Y MOVIMIENTO) ---
    public update(): void {
        if (!this.selfId) return;

        const selfView = this.playerViews.get(this.selfId);
        if (!selfView) return;

        const pad = this.input.gamepad?.getPad(0);
        
        // --- DEPURACIÓN DEL MANDO ---
        if (pad) {
            // Imprime en la consola los valores de los joysticks y la cruceta para ver qué detecta
            console.log(`Joystick X: ${pad.leftStick.x.toFixed(2)}, Y: ${pad.leftStick.y.toFixed(2)} | Arriba: ${pad.up} | Abajo: ${pad.down}`);
        }
        // ---------------------------

        let isUp = this.cursors.up.isDown || this.wasd.up.isDown;
        let isDown = this.cursors.down.isDown || this.wasd.down.isDown;
        let isLeft = this.cursors.left.isDown || this.wasd.left.isDown;
        let isRight = this.cursors.right.isDown || this.wasd.right.isDown;
        let isShift = Input.Keyboard.JustDown(this.shiftKey);

        if (pad) {
            const threshold = 0.2; // Bajamos el umbral para que sea más sensible
            const axisX = pad.leftStick.x;
            const axisY = pad.leftStick.y;

            isUp = isUp || pad.up || (axisY < -threshold);
            isDown = isDown || pad.down || (axisY > threshold);
            isLeft = isLeft || pad.left || (axisX < -threshold);
            isRight = isRight || pad.right || (axisX > threshold);
            const r1Pressed = pad.buttons[5] ? pad.buttons[5].pressed : false;
            isShift = isShift || r1Pressed;
        }

        const input: PlayerInput = {
            up: isUp,
            down: isDown,
            left: isLeft,
            right: isRight,
            shift: isShift,
        };

        this.processMovementAndDash(input, selfView);
    }

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
        
        this.socket.on('player:moved', (payload: any) => {
            const view = this.playerViews.get(payload.id);
            if (view && payload.id !== this.selfId) {
                view.update(payload);
            }
        });
    }

    private detachSocketListeners()
    {
        this.socket.off('connect', this.handleConnect);
        this.socket.off('disconnect', this.handleDisconnect);
        this.socket.off(SOCKET_EVENTS.ROOM_STATE, this.handleRoomState);
        this.socket.off(SOCKET_EVENTS.ROOM_ERROR, this.handleRoomError);
        this.socket.off(SOCKET_EVENTS.PLAYER_JOINED, this.handlePlayerJoined);
        this.socket.off(SOCKET_EVENTS.PLAYER_LEFT, this.handlePlayerLeft);
        this.socket.off('player:moved');
    }

    private triggerDashInvulnerability(): void {
        this.isInvulnerable = true;

        this.time.delayedCall(1000, () => {
            this.isInvulnerable = false;
        });
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
        this.syncPlayerViews();
    };

   // === 2. REEMPLAZA TU handleRoomState COMPLETO POR ESTE ===
    private readonly handleRoomState = (payload: RoomStatePayload) =>
    {
        this.roomText.setText(`Sala: ${payload.roomId}`);
        this.selfId = payload.selfId;
        this.playerRegistry.replaceAll(payload.players);
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