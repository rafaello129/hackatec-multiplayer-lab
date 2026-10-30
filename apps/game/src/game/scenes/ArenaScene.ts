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
    type WeaponStatePayload,
    type PickupStatePayload,
    type PickupCollectedPayload,
    type PlayerTrappedPayload,
    type PlayerHealedPayload,
    type PlayerEmotePayload,
    type StormStatePayload,
    type ZombieStatePayload,
    type ProgressionStatePayload,
    type ChatMessage,
    type ChatHistoryPayload,
    type RoomErrorPayload,
    type RoomStatePayload,
    type MatchStatePayload,
    type GameMode,
    type GameMapState,
    MATCH_TEXTS,
    CHAT_TEXTS
} from '@hackatec/shared';
import { Scene, type GameObjects, Input } from 'phaser';
import type { Socket } from 'socket.io-client';
import { ProfilePanel } from '../ui/ProfilePanel';
import { ArenaFrame } from '../ui/ArenaFrame';
import { MapView } from '../map/MapView';
import { PickupView } from '../map/PickupView';
import { StormView } from '../map/StormView';
import { ZombieView } from '../entities/ZombieView';
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
    private roomHostId = '';
    private mapView?: MapView;
    private pickupView?: PickupView;
    private stormView?: StormView;
    private zombieView?: ZombieView;
    private keys?: { w: Input.Keyboard.Key; a: Input.Keyboard.Key; s: Input.Keyboard.Key; d: Input.Keyboard.Key; shift: Input.Keyboard.Key };
    private previousInput = '';
    private lastInputSent = 0;
    private profilePanel?: ProfilePanel;
    private frame?: ArenaFrame;
    private minimalHudButton?: GameObjects.Text;
    private minimalHud = false;
    private scoreboard?: GameObjects.Text;
    private killFeedHud?: GameObjects.Text;
    private readonly killFeedIds = new Set<string>();
    private readonly killFeedLines: string[] = [];
    private healthBar?: GameObjects.Graphics;
    private weapon: WeaponType = 'pistol';
    private selectedSlot = 4;
    private weaponState?: WeaponStatePayload;
    private fireHeld = false;
    private lastFireSentAt = 0;
    private bullets?: GameObjects.Graphics;
    private combatText?: GameObjects.Text;
    private weaponHud?: GameObjects.Text;
    private progressionHud?: GameObjects.Text;
    private chatPanel?: GameObjects.Text;
    private chatInputHud?: GameObjects.Text;
    private readonly chatLines: string[] = [];
    private chatInputActive = false;
    private chatDraft = '';
    private progression?: ProgressionStatePayload;
    private matchState?: MatchStatePayload;
    private matchStatusText?: GameObjects.Text;
    private readonly voteButtons = new Map<GameMode, GameObjects.Text>();
    private hostMenuButton?: GameObjects.Text;
    private hostModeButton?: GameObjects.Text;
    private selectedHostMode: GameMode = 'classic';
    private readonly gameModeOrder: GameMode[] = ['classic', 'everyone-vs-one', 'rockets', 'battleRoyale', 'zombies'];
    private hostStartButton?: GameObjects.Text;
    private hostStopButton?: GameObjects.Text;
    private matchCountdownText?: GameObjects.Text;
    private spectatorStatusText?: GameObjects.Text;
    private spectatorTargetId = '';

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor()
    {
        super('ArenaScene');
    }
   
  
    public create(): void {
        this.cameras.main.setBackgroundColor('#07111f');

        this.identity = getClientIdentity(window.location.search);
        this.socket = getSocket();

        this.frame = new ArenaFrame(this, this.identity.roomId);
        this.minimalHudButton = this.add.text(985, 87, 'Ocultar extras', {
            fontFamily: 'Arial Black', fontSize: 10, color: '#e2e8f0',
            backgroundColor: '#0f172acc', padding: { x: 9, y: 6 }
        }).setOrigin(1, 0.5).setDepth(500).setScrollFactor(0).setInteractive({ useHandCursor: true });
        this.minimalHudButton.on('pointerdown', () => this.toggleMinimalHud());
        this.mapView = new MapView(this);
        this.pickupView = new PickupView(this);
        this.stormView = new StormView(this);
        this.zombieView = new ZombieView(this);
        this.bullets = this.add.graphics().setDepth(3);
        this.combatText = this.add.text(36, 105, '', { fontFamily: 'Arial', fontSize: 15, color: '#f8fafc' }).setDepth(8).setScrollFactor(0);
        this.progressionHud = this.add.text(280, 76, 'Nivel 1 · XP 0/100', {
            fontFamily: 'Arial Black', fontSize: 12, color: '#c4b5fd',
            stroke: '#020617', strokeThickness: 3
        }).setDepth(8).setScrollFactor(0);
        this.weaponHud = this.add.text(512, 690, '', {
            fontFamily: 'Arial Black', fontSize: 11, color: '#e2e8f0',
            backgroundColor: '#0f172acc', padding: { x: 10, y: 6 }, align: 'center'
        }).setOrigin(0.5).setDepth(8).setScrollFactor(0);
        this.input.keyboard?.on('keydown-ONE', this.selectSlot1);
        this.input.keyboard?.on('keydown-TWO', this.selectSlot2);
        this.input.keyboard?.on('keydown-THREE', this.selectSlot3);
        this.input.keyboard?.on('keydown-FOUR', this.selectSlot4);
        this.input.keyboard?.on('keydown-FIVE', this.selectSlot5);
        this.input.keyboard?.on('keydown-SIX', this.selectSlot6);
        this.input.keyboard?.on('keydown-SEVEN', this.selectSlot7);
        this.healthBar = this.add.graphics().setDepth(8).setScrollFactor(0);
        this.scoreboard = this.add.text(765, 390, '', { fontFamily:'Arial',fontSize:14,color:'#f8fafc',backgroundColor:'#0f172acc',padding:{x:10,y:8} }).setDepth(8);
        this.killFeedHud = this.add.text(36, 174, '', {
            fontFamily: 'Arial Black', fontSize: 12, color: '#f8fafc',
            backgroundColor: '#0f172acc', padding: { x: 8, y: 6 },
            fixedWidth: 270, lineSpacing: 3
        }).setDepth(8);
        this.chatPanel = this.add.text(765, 175, CHAT_TEXTS.panelTitle, {
            fontFamily: 'Arial', fontSize: 11, color: '#e2e8f0',
            backgroundColor: '#0f172acc', padding: { x: 9, y: 7 },
            fixedWidth: 235, fixedHeight: 170, wordWrap: { width: 218 },
            lineSpacing: 3
        }).setDepth(9).setScrollFactor(0);
        this.chatInputHud = this.add.text(765, 352, CHAT_TEXTS.inputIdle, {
            fontFamily: 'Arial', fontSize: 11, color: '#94a3b8',
            backgroundColor: '#0f172acc', padding: { x: 9, y: 6 }, fixedWidth: 235
        }).setDepth(9);
        this.profilePanel = new ProfilePanel((username, appearance) => this.socket.emit(SOCKET_EVENTS.PROFILE_SET, { username: username || undefined, appearance }));
        this.attachSocketListeners();

        // --- INICIALIZAR TECLADO GLOBALMENTE ---
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.keys = {
                w: this.input.keyboard.addKey(Input.Keyboard.KeyCodes.W),
                a: this.input.keyboard.addKey(Input.Keyboard.KeyCodes.A),
                s: this.input.keyboard.addKey(Input.Keyboard.KeyCodes.S),
                d: this.input.keyboard.addKey(Input.Keyboard.KeyCodes.D),
                shift: this.input.keyboard.addKey(Input.Keyboard.KeyCodes.SHIFT)
            };
            this.input.keyboard.enabled = true;
            this.input.keyboard.on('keydown', this.handleChatKeydown);
            this.input.keyboard.on('keydown', this.handleEmoteKeydown);
        }

        this.events.once('shutdown', () => {
            this.detachSocketListeners();
            this.clearPlayerViews();
            this.mapView?.destroy();
            this.pickupView?.destroy();
            this.stormView?.destroy();
            this.zombieView?.destroy();
            this.profilePanel?.destroy();
            this.frame?.destroy();
            this.minimalHudButton?.destroy();
            document.body.classList.remove('hud-minimal');
            this.input.keyboard?.off('keydown-ONE', this.selectSlot1);
            this.input.keyboard?.off('keydown-TWO', this.selectSlot2);
            this.input.keyboard?.off('keydown-THREE', this.selectSlot3);
            this.input.keyboard?.off('keydown-FOUR', this.selectSlot4);
            this.input.keyboard?.off('keydown-FIVE', this.selectSlot5);
            this.input.keyboard?.off('keydown-SIX', this.selectSlot6);
            this.input.keyboard?.off('keydown-SEVEN', this.selectSlot7);
            this.input.keyboard?.off('keydown', this.handleChatKeydown);
            this.input.keyboard?.off('keydown', this.handleEmoteKeydown);
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
            for (const button of this.voteButtons.values()) button.destroy();
            this.voteButtons.clear();
            this.hostMenuButton?.destroy();
            this.hostModeButton?.destroy();
            this.hostStartButton?.destroy();
            this.hostStopButton?.destroy();
            this.matchCountdownText?.destroy();
            this.spectatorStatusText?.destroy();
        });
    }

    private createMatchInterface(): void {
        this.matchStatusText = this.add.text(512, 142, 'Esperando jugadores…', {
            fontFamily: 'Arial Black', fontSize: 17, color: '#f8fafc',
            backgroundColor: '#0f172acc', padding: { x: 12, y: 7 }, align: 'center'
        }).setOrigin(0.5).setDepth(320).setScrollFactor(0);

        this.spectatorStatusText = this.add.text(512, 650, '', {
            fontFamily: 'Arial Black', fontSize: 13, color: '#e0f2fe',
            backgroundColor: '#0c4a6ecc', padding: { x: 10, y: 6 }, align: 'center'
        }).setOrigin(0.5).setDepth(330).setScrollFactor(0).setVisible(false);

        this.matchCountdownText = this.add.text(512, 178, '', {
            fontFamily: 'Arial Black', fontSize: 20, color: '#facc15',
            backgroundColor: '#0f172acc', padding: { x: 10, y: 5 }, align: 'center'
        }).setOrigin(0.5).setDepth(320).setScrollFactor(0);

        const modeOptions: Array<{ mode: GameMode; label: string }> = [
            { mode: 'classic', label: MATCH_TEXTS.modes.classic },
            { mode: 'everyone-vs-one', label: MATCH_TEXTS.modes.everyoneVsOne },
            { mode: 'rockets', label: MATCH_TEXTS.modes.rockets },
            { mode: 'battleRoyale', label: MATCH_TEXTS.modes.battleRoyale },
            { mode: 'zombies', label: MATCH_TEXTS.modes.zombies }
        ];
        const modeSpacing = 150;
        modeOptions.forEach(({ mode, label }, index) => {
            const x = 512 + (index - (modeOptions.length - 1) / 2) * modeSpacing;
            const button = this.add.text(x, 220, label, {
                fontFamily: 'Arial Black', fontSize: 13, color: '#ffffff',
                backgroundColor: '#0369a1', padding: { x: 9, y: 8 },
                align: 'center', fixedWidth: 145
            }).setOrigin(0.5).setDepth(321).setScrollFactor(0).setInteractive().setVisible(false);
            button.on('pointerdown', () => this.socket.emit(SOCKET_EVENTS.MATCH_VOTE, { mode }));
            this.voteButtons.set(mode, button);
        });

        this.hostMenuButton = this.add.text(870, 112, MATCH_TEXTS.controls.hostMenu, {
            fontFamily: 'Arial Black', fontSize: 14, color: '#facc15',
            backgroundColor: '#1e293b', padding: { x: 10, y: 7 }
        }).setOrigin(0.5).setDepth(321).setScrollFactor(0).setInteractive().setVisible(false);
        this.hostMenuButton.on('pointerdown', () => {
            const visible = !this.hostStartButton?.visible;
            this.hostModeButton?.setVisible(visible);
            this.hostStartButton?.setVisible(visible);
            this.hostStopButton?.setVisible(visible);
        });

        this.hostModeButton = this.add.text(870, 150, 'Modo: Clásico', {
            fontFamily: 'Arial', fontSize: 12, color: '#ffffff',
            backgroundColor: '#334155', padding: { x: 9, y: 6 }
        }).setOrigin(0.5).setDepth(321).setScrollFactor(0).setInteractive().setVisible(false);
        this.hostModeButton.on('pointerdown', () => {
            const currentIndex = this.gameModeOrder.indexOf(this.selectedHostMode);
            this.selectedHostMode = this.gameModeOrder[(currentIndex + 1) % this.gameModeOrder.length] ?? 'classic';
            this.hostModeButton?.setText('Modo: ' + this.getModeLabel(this.selectedHostMode));
        });

        this.hostStartButton = this.add.text(870, 188, 'Iniciar modo elegido', {
            fontFamily: 'Arial', fontSize: 13, color: '#ffffff',
            backgroundColor: '#166534', padding: { x: 9, y: 6 }
        }).setOrigin(0.5).setDepth(321).setScrollFactor(0).setInteractive().setVisible(false);
        this.hostStartButton.on('pointerdown', () => this.socket.emit(SOCKET_EVENTS.MATCH_HOST_START, { mode: this.selectedHostMode }));

        this.hostStopButton = this.add.text(870, 226, MATCH_TEXTS.controls.hostStop, {
            fontFamily: 'Arial', fontSize: 13, color: '#ffffff',
            backgroundColor: '#991b1b', padding: { x: 9, y: 6 }
        }).setOrigin(0.5).setDepth(321).setScrollFactor(0).setInteractive().setVisible(false);
        this.hostStopButton.on('pointerdown', () => {
            this.socket.emit(SOCKET_EVENTS.MATCH_HOST_STOP);
            this.hostModeButton?.setVisible(false);
            this.hostStartButton?.setVisible(false);
            this.hostStopButton?.setVisible(false);
        });
    }

    private readonly handleMatchState = (state: MatchStatePayload): void => {
        this.matchState = state;
        if (state.phase === 'countdown' || state.phase === 'waiting') {
            this.killFeedIds.clear();
            this.killFeedLines.length = 0;
            this.killFeedHud?.setText('');
            this.scoreboard?.setText('');
        }
        this.stormView?.setActive(state.mode === 'battleRoyale' && state.phase === 'playing');
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
        this.matchStatusText?.setText(state.message ? labels[state.phase] + '\n' + state.message : labels[state.phase]);
        for (const [mode, button] of this.voteButtons) {
            const selected = state.votes[this.selfId] === mode;
            button.setText((selected ? '✓ ' : '') + this.getModeLabel(mode));
            button.setVisible(state.phase === 'voting');
        }
        this.hostMenuButton?.setVisible(host);
        if (!host) {
            this.hostModeButton?.setVisible(false);
            this.hostStartButton?.setVisible(false);
            this.hostStopButton?.setVisible(false);
        }
        if (state.phase === 'voting') {
            this.matchStatusText?.setText(labels[state.phase] + ' · ' + voteCount + ' voto(s)');
        } else if (state.phase === 'results' && state.results.length > 0) {
            const lines = state.results.slice(0, 5).map((result, index) =>
                `${index + 1}. ${result.name}: ${result.kills} bajas · ${result.deaths} muertes · ${result.assists ?? 0} asistencias · ${result.zombieKills ?? 0} zombies`
            );
            this.scoreboard?.setText('RESULTADOS\n' + lines.join('\n'));
            const winner = state.winnerName ? 'Ganador: ' + state.winnerName + '\n' : '';
            this.matchStatusText?.setText(labels[state.phase] + '\n' + winner + (state.message ?? ''));
        }
        this.updateMatchClock();
    };

    private toggleMinimalHud(): void {
        this.minimalHud = !this.minimalHud;
        document.body.classList.toggle('hud-minimal', this.minimalHud);
        this.minimalHudButton?.setText(this.minimalHud ? 'Mostrar extras' : 'Ocultar extras');
        this.applyMinimalHud();
    }

    private applyMinimalHud(): void {
        const alpha = this.minimalHud ? 0 : 1;
        this.frame?.setMinimalHud(this.minimalHud);
        const secondary: Array<GameObjects.Text | undefined> = [
            this.combatText, this.progressionHud, this.scoreboard, this.killFeedHud,
            this.chatPanel, this.chatInputHud, this.matchStatusText, this.matchCountdownText,
            this.spectatorStatusText, ...this.voteButtons.values(),
            this.hostMenuButton, this.hostModeButton, this.hostStartButton, this.hostStopButton
        ];
        for (const item of secondary) {
            if (!item) continue;
            item.setAlpha(alpha);
            if (this.minimalHud) item.disableInteractive();
            else if (item === this.hostMenuButton || item === this.hostModeButton ||
                item === this.hostStartButton || item === this.hostStopButton ||
                [...this.voteButtons.values()].includes(item as GameObjects.Text)) {
                item.setInteractive({ useHandCursor: true });
            }
        }
    }

    private getModeLabel(mode: GameMode): string {
        switch (mode) {
            case 'everyone-vs-one': return MATCH_TEXTS.modes.everyoneVsOne;
            case 'rockets': return MATCH_TEXTS.modes.rockets;
            case 'battleRoyale': return MATCH_TEXTS.modes.battleRoyale;
            case 'zombies': return MATCH_TEXTS.modes.zombies;
            case 'classic':
            default: return MATCH_TEXTS.modes.classic;
        }
    }

    private readonly handleZombieState = (state: ZombieStatePayload): void => {
        this.zombieView?.sync(state);
        const round = state.round ?? 1;
        const total = state.totalRounds ?? 10;
        const phase = state.runPhase;
        if (phase === 'boss') this.combatText?.setText('JEFE FINAL · ¡DERROTEN AL ZOMBI!');
        else if (phase === 'intermission') this.combatText?.setText('RONDA ' + round + '/' + total + ' · PREPÁRENSE PARA LA SIGUIENTE');
        else if (phase === 'won') this.combatText?.setText('¡VICTORIA! JEFE ZOMBI DERROTADO');
        else if (phase === 'lost') this.combatText?.setText('DERROTA · TODO EL EQUIPO FUE ELIMINADO');
        else if (phase === 'wave') this.combatText?.setText('RONDA ' + round + '/' + total);
    };

    private readonly handleStormState = (state: StormStatePayload): void => {
        this.stormView?.render(state);
        this.stormView?.setActive(this.matchState?.mode === 'battleRoyale' && this.matchState.phase === 'playing');
    };

    private readonly handleRoomMap = (map: GameMapState): void => {
        this.mapView?.render(map);
        this.cameras.main.setBounds(0, 0, map.width, map.height);
    };

    private readonly handleHostChanged = (payload: { hostId: string }): void => {
        this.roomHostId = payload.hostId;
        const isHost = this.roomHostId === this.selfId;
        this.hostMenuButton?.setVisible(isHost);
        if (!isHost) { this.hostModeButton?.setVisible(false); this.hostStartButton?.setVisible(false); this.hostStopButton?.setVisible(false); }
    };

    private readonly handleMatchActionResult = (result: { ok: boolean; message: string }): void => {
        if (!result.ok) this.frame?.showError(result.message);
        else this.frame?.clearError();
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

    private attachSocketListeners()
    {
        this.socket.on('connect', this.handleConnect);
        this.socket.on('disconnect', this.handleDisconnect);
        this.socket.on(SOCKET_EVENTS.ROOM_STATE, this.handleRoomState);
        this.socket.on(SOCKET_EVENTS.ROOM_ERROR, this.handleRoomError);
        this.socket.on(SOCKET_EVENTS.PLAYER_JOINED, this.handlePlayerJoined);
        this.socket.on(SOCKET_EVENTS.PLAYER_LEFT, this.handlePlayerLeft);
        this.socket.on(SOCKET_EVENTS.PLAYER_MOVED, this.handlePlayerMoved);
        this.socket.on(SOCKET_EVENTS.PLAYER_EMOTE, this.handlePlayerEmote);
        this.socket.on(SOCKET_EVENTS.COMBAT_STATE, this.handleCombat);
        this.socket.on(SOCKET_EVENTS.STORM_STATE, this.handleStormState);
        this.socket.on(SOCKET_EVENTS.ZOMBIE_STATE, this.handleZombieState);
        this.socket.on(SOCKET_EVENTS.PICKUP_STATE, this.handlePickupState);
        this.socket.on(SOCKET_EVENTS.PICKUP_COLLECTED, this.handlePickupCollected);
        this.socket.on(SOCKET_EVENTS.PLAYER_TRAPPED, this.handlePlayerTrapped);
        this.socket.on(SOCKET_EVENTS.PLAYER_HEALED, this.handlePlayerHealed);
        this.socket.on(SOCKET_EVENTS.WEAPON_STATE, this.handleWeaponState);
        this.socket.on(SOCKET_EVENTS.WEAPON_RESULT, this.handleWeaponResult);
        this.socket.on(SOCKET_EVENTS.PROFILE_RESULT, this.handleProfileResult);
        this.socket.on(SOCKET_EVENTS.MATCH_STATE, this.handleMatchState);
        this.socket.on(SOCKET_EVENTS.PROGRESSION_STATE, this.handleProgressionState);
        this.socket.on(SOCKET_EVENTS.CHAT_HISTORY, this.handleChatHistory);
        this.socket.on(SOCKET_EVENTS.CHAT_MESSAGE, this.handleChatMessage);
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
        this.socket.off(SOCKET_EVENTS.PLAYER_EMOTE, this.handlePlayerEmote);
        this.socket.off(SOCKET_EVENTS.COMBAT_STATE, this.handleCombat);
        this.socket.off(SOCKET_EVENTS.STORM_STATE, this.handleStormState);
        this.socket.off(SOCKET_EVENTS.ZOMBIE_STATE, this.handleZombieState);
        this.socket.off(SOCKET_EVENTS.PICKUP_STATE, this.handlePickupState);
        this.socket.off(SOCKET_EVENTS.PICKUP_COLLECTED, this.handlePickupCollected);
        this.socket.off(SOCKET_EVENTS.PLAYER_TRAPPED, this.handlePlayerTrapped);
        this.socket.off(SOCKET_EVENTS.PLAYER_HEALED, this.handlePlayerHealed);
        this.socket.off(SOCKET_EVENTS.WEAPON_STATE, this.handleWeaponState);
        this.socket.off(SOCKET_EVENTS.WEAPON_RESULT, this.handleWeaponResult);
        this.socket.off(SOCKET_EVENTS.PROFILE_RESULT, this.handleProfileResult);
        this.socket.off(SOCKET_EVENTS.MATCH_STATE, this.handleMatchState);
        this.socket.off(SOCKET_EVENTS.PROGRESSION_STATE, this.handleProgressionState);
        this.socket.off(SOCKET_EVENTS.CHAT_HISTORY, this.handleChatHistory);
        this.socket.off(SOCKET_EVENTS.CHAT_MESSAGE, this.handleChatMessage);
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

        this.frame?.clearError();
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
        this.spectatorTargetId = '';
        this.chatInputActive = false;
        this.chatDraft = '';
        this.chatLines.length = 0;
        this.killFeedIds.clear();
        this.killFeedLines.length = 0;
        this.killFeedHud?.setText('');
        this.chatPanel?.setText(CHAT_TEXTS.panelTitle);
        this.chatInputHud?.setText(CHAT_TEXTS.inputIdle);
        this.progression = undefined;
        this.progressionHud?.setText('Nivel 1 · XP 0/100');
        this.cameras.main.stopFollow();
        this.spectatorStatusText?.setVisible(false);
        this.roomHostId = '';
        this.previousInput = '';
        this.mapView?.clear();
        this.pickupView?.clear();
        this.stormView?.clear();
        this.zombieView?.clear();
        this.bullets?.clear();
        this.syncPlayerViews();
    };

   // === 2. REEMPLAZA TU handleRoomState COMPLETO POR ESTE ===
    private readonly handleRoomState = (payload: RoomStatePayload) =>
    {
        this.frame?.setRoom(payload.roomId);
        this.selfId = payload.selfId;
        const own = payload.players.find(player => player.id === payload.selfId);
        if (own?.appearance) this.profilePanel?.setProfile(own.name, own.appearance);
        this.playerRegistry.replaceAll(payload.players);
        this.mapView?.render(payload.map);
        this.cameras.main.setBounds(0, 0, payload.map.width, payload.map.height);
        this.syncPlayerViews();
        if (payload.hostId) this.roomHostId = payload.hostId;

        const myPlayerState = this.playerRegistry.get(this.selfId);
        if (myPlayerState) {
            this.upsertPlayerView(myPlayerState);
            const ownView = this.playerViews.get(this.selfId);
            if (!myPlayerState.spectator && myPlayerState.alive !== false && ownView) {
                this.cameras.main.startFollow(ownView.container, true, 0.08, 0.08);
            }
        }
    };

    private readonly handleRoomError = (payload: RoomErrorPayload) =>
    {
        this.frame?.showError(`${payload.code}: ${payload.message}`);
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

    private readonly handlePlayerEmote = (payload: PlayerEmotePayload): void => {
        this.playerViews.get(payload.playerId)?.playEmote(payload.emote);
    };

    private readonly handleEmoteKeydown = (event: KeyboardEvent): void => {
        if (event.repeat || this.chatInputActive || !this.socket?.connected || !this.selfId) return;
        const emotes: Record<string, PlayerEmotePayload['emote']> = {
            c: 'spin', v: 'jump', b: 'crouch', n: 'shake'
        };
        const emote = emotes[event.key.toLowerCase()];
        if (!emote) return;
        const self = this.playerRegistry.get(this.selfId);
        if (!self || self.spectator || self.alive === false) return;
        this.socket.emit(SOCKET_EVENTS.PLAYER_EMOTE, { emote });
    };

    private readonly selectSlot1 = () => this.selectWeapon(1);
    private readonly selectSlot2 = () => this.selectWeapon(2);
    private readonly selectSlot3 = () => this.selectWeapon(3);
    private readonly selectSlot4 = () => this.selectWeapon(4);
    private readonly selectSlot5 = () => this.selectWeapon(5);
    private readonly selectSlot6 = () => this.selectWeapon(6);
    private readonly selectSlot7 = () => this.selectWeapon(7);

    private selectWeapon(slot: number): void {
        if (this.chatInputActive) return;
        if (this.weaponState && !this.weaponState.availableSlots.includes(slot as WeaponStatePayload['selectedSlot'])) return;
        if (!this.socket?.connected || !this.selfId) return;
        this.socket.emit(SOCKET_EVENTS.WEAPON_SELECT, { slot });
    }

    private readonly handleWeaponState = (state: WeaponStatePayload) => {
        this.weaponState = state;
        this.weapon = state.selectedWeapon;
        this.selectedSlot = state.selectedSlot;
        const labels: Record<number, string> = {
            1: 'Cuchillo', 2: 'Metralleta', 3: 'Escopeta',
            4: 'Pistola', 5: 'Sniper', 6: 'Cohete'
        };
        const slots = [1, 2, 3, 4, 5, 6];
        const canSeeSecretWeapon = state.availableSlots.includes(7);
        if (canSeeSecretWeapon) {
            labels[7] = 'Láser';
            slots.push(7);
        }
        const hotbar = slots.map(slot => {
            const selected = slot === state.selectedSlot;
            const available = state.availableSlots.includes(slot as WeaponStatePayload['selectedSlot']);
            return (selected ? '【' : '') + slot + ' ' + labels[slot] + (available ? '' : ' 🔒') + (selected ? '】' : '');
        }).join('   ');
        const secretEnergy = canSeeSecretWeapon && state.laserEnergyMs !== undefined
            ? '   Láser: ' + (state.laserEnergyMs / 1_000).toFixed(1) + 's'
            : '';
        this.weaponHud?.setText(hotbar + secretEnergy);
    };

    private readonly handleWeaponResult = (result: { ok: boolean; message: string }) => {
        if (!result.ok) this.frame?.showError(result.message);
    };

    private readonly handleProfileResult = (result: {ok:boolean;message:string}) => {
        this.profilePanel?.setStatus(result.message, !result.ok);
        if (!result.ok) this.frame?.showError(result.message);
        else this.frame?.clearError();
    };

    private readonly handleProgressionState = (state: ProgressionStatePayload) => {
        this.progression = state;
        this.progressionHud?.setText(
            'Nivel ' + state.level + ' · XP ' + state.xp + '/' + state.xpToNextLevel +
            ' · Total ' + state.totalXP
        );
        if (state.awardedXP && state.awardedXP > 0) {
            this.pushChatLine(CHAT_TEXTS.systemPrefix + state.awardedXP + CHAT_TEXTS.systemSuffix);
        }
    };

    private readonly handleChatHistory = (payload: ChatHistoryPayload) => {
        this.chatLines.length = 0;
        for (const message of payload.messages) this.chatLines.push(this.formatChatMessage(message));
        this.renderChatPanel();
    };

    private readonly handleChatMessage = (payload: ChatMessage | { error?: string }) => {
        const error = (payload as { error?: unknown }).error;
        if (typeof error === 'string') {
            this.frame?.showError(error);
            return;
        }
        const message = payload as ChatMessage;
        this.pushChatLine(this.formatChatMessage(message));
        this.playerViews.get(message.senderId)?.showChat(message.text);
    };

    private formatChatMessage(message: ChatMessage): string {
        const date = new Date(message.createdAt);
        const time = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const channel = message.channel === 'spectators' ? CHAT_TEXTS.spectatorPrefix : '';
        return time + ' ' + channel + message.senderName + ': ' + message.text;
    }

    private pushChatLine(line: string): void {
        this.chatLines.push(line);
        if (this.chatLines.length > 8) this.chatLines.splice(0, this.chatLines.length - 8);
        this.renderChatPanel();
    }

    private renderChatPanel(): void {
        const heading = CHAT_TEXTS.panelTitle;
        this.chatPanel?.setText([heading, ...this.chatLines].join('\n'));
    }

    private readonly handleChatKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!this.chatInputActive) {
                this.chatInputActive = true;
                this.chatDraft = '';
                this.chatInputHud?.setText(CHAT_TEXTS.inputPrompt);
            } else {
                const text = this.chatDraft.trim();
                if (text && this.socket?.connected) {
                    const self = this.playerRegistry.get(this.selfId);
                    this.socket.emit(SOCKET_EVENTS.CHAT_SEND, {
                        channel: self?.spectator ? 'spectators' : 'all',
                        text
                    });
                }
                this.chatInputActive = false;
                this.chatDraft = '';
                this.chatInputHud?.setText(CHAT_TEXTS.inputIdle);
            }
            return;
        }
        if (!this.chatInputActive) return;
        event.preventDefault();
        if (event.key === 'Escape') {
            this.chatInputActive = false;
            this.chatDraft = '';
            this.chatInputHud?.setText(CHAT_TEXTS.inputIdle);
        } else if (event.key === 'Backspace') {
            this.chatDraft = [...this.chatDraft].slice(0, -1).join('');
            this.chatInputHud?.setText(CHAT_TEXTS.inputPrefix + this.chatDraft + '▌');
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && [...this.chatDraft].length < 120) {
            this.chatDraft += event.key;
            this.chatInputHud?.setText(CHAT_TEXTS.inputPrefix + this.chatDraft + '▌');
        }
    };

    private readonly handlePickupState = (payload: PickupStatePayload) => {
        this.pickupView?.sync(payload.pickups);
    };

    private readonly handlePickupCollected = (payload: PickupCollectedPayload) => {
        const view = this.playerViews.get(payload.playerId);
        view?.showHeal(payload.restored);
    };

    private readonly handlePlayerTrapped = (payload: PlayerTrappedPayload) => {
        const player = this.playerRegistry.get(payload.playerId);
        if (!player) return;
        player.immobilizedUntil = payload.trappedUntil;
        this.playerViews.get(payload.playerId)?.update(player);
    };

    private readonly handlePlayerHealed = (payload: PlayerHealedPayload) => {
        this.playerViews.get(payload.playerId)?.showHeal(payload.amount);
    };

    private readonly handleCombat = (state: CombatSnapshot) => {
        this.playerRegistry.replaceAll(state.players);
        this.syncPlayerViews();
        for (const kill of state.killFeed ?? []) {
            if (this.killFeedIds.has(kill.id)) continue;
            this.killFeedIds.add(kill.id);
            this.killFeedLines.push(kill.killerName + '  ☠  ' + kill.victimName);
            if (this.killFeedLines.length > 6) this.killFeedLines.shift();
        }
        this.killFeedHud?.setText(this.killFeedLines.join('\n'));
        const self = state.players.find(player => player.id === this.selfId);
        if (self?.spectator) this.syncSpectatorCamera(state.players);
        else if (self && self.alive !== false) {
            const ownView = this.playerViews.get(this.selfId);
            if (ownView) this.cameras.main.startFollow(ownView.container, true, 0.08, 0.08);
        }
        this.scoreboard?.setText('CLASIFICACIÓN\n' + [...state.players].sort((a,b)=>(b.kills??0)-(a.kills??0)).slice(0,8).map((p,i)=>`${i+1}. ${p.name}: ${p.kills??0} / ${p.deaths??0}`).join('\n'));
        this.healthBar?.clear();
        if (self) {
            const hp = Math.max(0, Math.min(self.maxHp ?? 100, self.hp ?? 100));
            const maxHp = Math.max(1, self.maxHp ?? 100);
            const shield = Math.max(0, Math.min(50, self.shield ?? 0));
            this.healthBar?.fillStyle(0x334155).fillRect(36, 127, 220, 12);
            this.healthBar?.fillStyle((hp / maxHp) > 0.3 ? 0x22c55e : 0xef4444)
                .fillRect(36, 127, 220 * hp / maxHp, 12);
            this.healthBar?.fillStyle(0x0f172a).fillRect(36, 145, 220, 8);
            this.healthBar?.fillStyle(0x38bdf8).fillRect(36, 145, 220 * shield / 50, 8);
        }
        if (self) {
            const role = self.role === 'titan' ? 'TITAN' : self.role === 'hunter' ? 'CAZADOR' : '';
            const lives = self.role === 'hunter' ? ' · Vidas: ' + (self.lives ?? 0) : '';
            const shield = self.shield ? ' · Escudo: ' + Math.round(self.shield) : '';
            this.combatText?.setText(self.spectator ? MATCH_TEXTS.controls.spectator :
                (role ? role + ' · ' : '') + `HP: ${self.hp ?? 100}${shield}${lives} · Kills: ${self.kills ?? 0} · Deaths: ${self.deaths ?? 0} · ${this.weapon}${self.alive === false ? ' · RESPAWN...' : ''}`);
        }
        this.bullets?.clear();
        for (const projectile of state.projectiles) {
            const isRocket = projectile.weapon === 'rocketLauncher';
            this.bullets?.fillStyle(isRocket ? 0xfb923c : 0xfacc15, 1);
            this.bullets?.fillCircle(projectile.x, projectile.y, isRocket ? 9 : 5);
        }
        for (const beam of state.beams ?? []) {
            this.bullets?.lineStyle(beam.weapon === 'sniper' ? 3 : 4, beam.weapon === 'sniper' ? 0xf8fafc : 0x67e8f9, beam.weapon === 'sniper' ? 1 : 0.9);
            this.bullets?.beginPath();
            this.bullets?.moveTo(beam.x1, beam.y1);
            this.bullets?.lineTo(beam.x2, beam.y2);
            this.bullets?.strokePath();
            if (beam.weapon === 'sniper') this.bullets?.fillStyle(0xfbbf24, 1).fillCircle(beam.x2, beam.y2, 4);
        }
        for (const explosion of state.explosions ?? []) {
            this.bullets?.lineStyle(3, 0xfb923c, 0.9);
            this.bullets?.strokeCircle(explosion.x, explosion.y, explosion.radius);
            this.bullets?.fillStyle(0xf97316, 0.16);
            this.bullets?.fillCircle(explosion.x, explosion.y, explosion.radius);
        }
    };

    update(time: number) {
        this.applyMinimalHud();
        this.stormView?.update();
        if (!this.socket?.connected || !this.selfId || !this.keys || !this.cursors) return;
        if (this.chatInputActive) return;
        const self = this.playerRegistry.get(this.selfId);
        if (self?.spectator) {
            if (Input.Keyboard.JustDown(this.keys.a)) this.cycleSpectatorTarget(-1);
            if (Input.Keyboard.JustDown(this.keys.d)) this.cycleSpectatorTarget(1);
            return;
        }
        if (this.spectatorTargetId) {
            this.cameras.main.stopFollow();
            this.spectatorTargetId = '';
            this.spectatorStatusText?.setVisible(false);
        }
        const pad = this.input.gamepad?.getPad(0);
        const x = pad?.leftStick.x ?? 0;
        const y = pad?.leftStick.y ?? 0;
        const dashHeld = this.keys.shift.isDown || !!pad?.buttons[5]?.pressed;
        const player = this.playerRegistry.get(this.selfId);
        const pointer = this.input.activePointer;
        const point = player ? this.cameras.main.getWorldPoint(pointer.x, pointer.y) : { x: 0, y: 0 };
        const angle = player ? Math.atan2(point.y - player.y, point.x - player.x) : 0;
        const input: PlayerInput = {
            up: this.keys.w.isDown || this.cursors.up.isDown || y < -0.2 || !!pad?.up,
            down: this.keys.s.isDown || this.cursors.down.isDown || y > 0.2 || !!pad?.down,
            left: this.keys.a.isDown || this.cursors.left.isDown || x < -0.2 || !!pad?.left,
            right: this.keys.d.isDown || this.cursors.right.isDown || x > 0.2 || !!pad?.right,
            dash: dashHeld,
            aimAngle: angle
        };

        const holding = Boolean(player && player.alive !== false && !player.spectator && pointer.isDown);
        if (player) {
            if (holding !== this.fireHeld || time - this.lastFireSentAt >= 50) {
                this.socket.emit(SOCKET_EVENTS.WEAPON_FIRE, { angle, firing: holding });
                this.lastFireSentAt = time;
            }
        }
        this.fireHeld = holding;

        const serialized = JSON.stringify(input);
        if (serialized !== this.previousInput || time - this.lastInputSent >= 100) {
            this.socket.emit(SOCKET_EVENTS.PLAYER_INPUT, { input });
            this.previousInput = serialized;
            this.lastInputSent = time;
        }
    }

    private syncSpectatorCamera(players: PlayerState[]): void {
        const available = players.filter(player =>
            player.id !== this.selfId && player.alive !== false && !player.spectator
        );
        if (available.length === 0) {
            this.cameras.main.stopFollow();
            this.spectatorTargetId = '';
            this.spectatorStatusText?.setText('ESPECTADOR · No quedan jugadores activos').setVisible(true);
            return;
        }
        if (!available.some(player => player.id === this.spectatorTargetId)) {
            this.spectatorTargetId = available[0]!.id;
        }
        const target = available.find(player => player.id === this.spectatorTargetId)!;
        const view = this.playerViews.get(target.id);
        if (view) this.cameras.main.startFollow(view.container, true, 0.08, 0.08);
        this.spectatorStatusText?.setText(
            'ESPECTADOR · Observando ' + target.name + ' · A / D para cambiar'
        ).setVisible(true);
    }

    private cycleSpectatorTarget(direction: number): void {
        const available = this.playerRegistry.getAll().filter(player =>
            player.id !== this.selfId && player.alive !== false && !player.spectator
        );
        if (available.length === 0) return;
        const currentIndex = available.findIndex(player => player.id === this.spectatorTargetId);
        const nextIndex = (currentIndex + direction + available.length) % available.length;
        this.spectatorTargetId = available[nextIndex]!.id;
        this.syncSpectatorCamera(this.playerRegistry.getAll());
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
        this.frame?.setPlayerCount(this.playerRegistry.size);
    }

    private setConnectionStatus(status: ConnectionStatus): void
    {
        this.frame?.setConnectionStatus(status);
    }
} // <-- Esta es la llave final que cierra la clase ArenaScene
