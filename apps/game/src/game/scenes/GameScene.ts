import Phaser from 'phaser';
import { PlayerInput } from '@shared/types';
import { io, Socket } from 'socket.io-client';

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private shiftKey!: Phaser.Input.Keyboard.Key;

  private playerSpeed: number = 5;
  private playerX: number = 400;
  private playerY: number = 300;
  private playerSprite!: Phaser.GameObjects.Rectangle;
  private isInvulnerable: boolean = false;

  private socket!: Socket;
  private otherPlayers: Map<string, Phaser.GameObjects.Rectangle> = new Map();

  private mapWidth: number = 800;
  private mapHeight: number = 600;
  private playerRadius: number = 20;

  constructor() {
    super('GameScene');
  }

  public create(): void {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }

    // Sprite local del jugador
    this.playerSprite = this.add.rectangle(this.playerX, this.playerY, 40, 40, 0x5865f2);

    this.initSocketConnection();
  }

  private initSocketConnection(): void {
    this.socket = io('http://localhost:3000'); 

    this.socket.on('connect', () => {
      console.log('Conectado al servidor de juego con ID:', this.socket.id);
    });

    this.socket.on('currentPlayers', (players: Record<string, any>) => {
      Object.keys(players).forEach((id) => {
        if (id === this.socket.id) {
          this.playerX = players[id].x;
          this.playerY = players[id].y;
          this.playerSprite.setPosition(this.playerX, this.playerY);
        } else {
          this.createOtherPlayer(id, players[id]);
        }
      });
    });

    this.socket.on('newPlayer', (playerInfo: any) => {
      this.createOtherPlayer(playerInfo.id, playerInfo);
    });

    this.socket.on('disconnectPlayer', (id: string) => {
      if (this.otherPlayers.has(id)) {
        this.otherPlayers.get(id)?.destroy();
        this.otherPlayers.delete(id);
      }
    });

    // --- FASE 4: Sincronización en Red del Feedback Visual y Posición ---
    this.socket.on('playerMoved', (playerInfo: any) => {
      if (this.otherPlayers.has(playerInfo.id)) {
        const p = this.otherPlayers.get(playerInfo.id);
        if (p) {
          p.setPosition(playerInfo.x, playerInfo.y);
          
          // Reflejar el feedback visual de invulnerabilidad (transparencia) transmitido por la red
          p.setAlpha(playerInfo.isInvulnerable ? 0.5 : 1.0);
        }
      }
    });
  }

  private createOtherPlayer(id: string, playerInfo: any): void {
    const otherSprite = this.add.rectangle(playerInfo.x, playerInfo.y, 40, 40, 0xed4245);
    // Aplicar estado visual inicial si el otro jugador ya está invulnerable
    otherSprite.setAlpha(playerInfo.isInvulnerable ? 0.5 : 1.0);
    this.otherPlayers.set(id, otherSprite);
  }

  public update(): void {
    const input: PlayerInput = {
      up: this.cursors.up.isDown || this.wasd.up.isDown,
      down: this.cursors.down.isDown || this.wasd.down.isDown,
      left: this.cursors.left.isDown || this.wasd.left.isDown,
      right: this.cursors.right.isDown || this.wasd.right.isDown,
      shift: Phaser.Input.Keyboard.JustDown(this.shiftKey),
    };

    this.processMovementAndDash(input);
  }

  private processMovementAndDash(input: PlayerInput): void {
    let vx = 0;
    let vy = 0;

    if (input.up) vy -= 1;
    if (input.down) vy += 1;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;

    if (vx !== 0 && vy !== 0) {
      const normalizationFactor = 1 / Math.sqrt(2);
      vx *= normalizationFactor;
      vy *= normalizationFactor;
    }

    let nextX = this.playerX + vx * this.playerSpeed;
    let nextY = this.playerY + vy * this.playerSpeed;

    const minLimit = this.playerRadius;
    const maxXLimit = this.mapWidth - this.playerRadius;
    const maxYLimit = this.mapHeight - this.playerRadius;

    nextX = Phaser.Math.Clamp(nextX, minLimit, maxXLimit);
    nextY = Phaser.Math.Clamp(nextY, minLimit, maxYLimit);

    this.playerX = nextX;
    this.playerY = nextY;

    if (input.shift && !this.isInvulnerable) {
      this.triggerDashInvulnerability();
    }

    this.playerSprite.setPosition(this.playerX, this.playerY);

    // --- FASE 4: Emisión en tiempo real del estado de invulnerabilidad y posición ---
    if (this.socket && this.socket.connected) {
      this.socket.emit('playerMovement', {
        x: this.playerX,
        y: this.playerY,
        isInvulnerable: this.isInvulnerable,
      });
    }
  }

  private triggerDashInvulnerability(): void {
    this.isInvulnerable = true;
    
    // Feedback visual local inmediato (transparencia al 50%)
    this.playerSprite.setAlpha(0.5);

    this.time.delayedCall(1000, () => {
      this.isInvulnerable = false;
      
      // Restaurar opacidad local al terminar el estado
      this.playerSprite.setAlpha(1.0);
    });
  }
}