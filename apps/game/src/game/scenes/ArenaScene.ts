import {
    SOCKET_EVENTS,
    type ConnectionStatus,
    type JoinRoomPayload,
    type PlayerJoinedPayload,
    type PlayerLeftPayload,
    type PlayerAppearanceChangedPayload,
    type PlayerState,
    type RoomErrorPayload,
    type RoomStatePayload,
    type PlayerUsernameChangedPayload,
    type SetUsernamePayload
} from '@hackatec/shared';
import { Scene, type GameObjects } from 'phaser';
import type { Socket } from 'socket.io-client';
import { PlayerView } from '../entities/PlayerView';
import {
    getClientIdentity,
    type ClientIdentity
} from '../../network/identity';
import {
    getSocket,
    serverUrl
} from '../../network/socket';
import { PlayerRegistry } from '../../state/PlayerRegistry';

export class ArenaScene extends Scene
{
    private socket!: Socket;
    private identity!: ClientIdentity;

    private readonly playerRegistry =
        new PlayerRegistry();

    private readonly playerViews =
        new Map<string, PlayerView>();

    private selfId = '';

    private roomText!: GameObjects.Text;
    private playerCountText!: GameObjects.Text;
    private connectionText!: GameObjects.Text;
    private errorText!: GameObjects.Text;

    private colorInput!: HTMLInputElement;
    private usernameInput!: HTMLInputElement;
    private skinInput!: HTMLInputElement;

    constructor()
    {
        super('ArenaScene');
    }

    create()
    {
        this.cameras.main.setBackgroundColor('#07111f');

        this.identity =
            getClientIdentity(window.location.search);

        this.socket = getSocket();

        this.createInterface();
        this.attachSocketListeners();

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
        this.add.rectangle(
            512,
            64,
            984,
            96,
            0x0f172a,
            0.96
        )
            .setStrokeStyle(
                1,
                0x334155,
                0.8
            );

        this.add.text(
            36,
            28,
            'HACKATEC MULTIPLAYER LAB',
            {
                fontFamily: 'Arial Black',
                fontSize: 20,
                color: '#f8fafc'
            }
        );

        this.roomText = this.add.text(
            36,
            68,
            `Sala: ${this.identity.roomId}`,
            {
                fontFamily: 'Arial',
                fontSize: 16,
                color: '#cbd5e1'
            }
        );

        this.playerCountText = this.add.text(
            512,
            45,
            'Players: 0',
            {
                fontFamily: 'Arial Black',
                fontSize: 18,
                color: '#f8fafc'
            }
        ).setOrigin(0.5);

        this.connectionText = this.add.text(
            988,
            30,
            '',
            {
                fontFamily: 'Arial Black',
                fontSize: 14,
                color: '#facc15',
                align: 'right'
            }
        ).setOrigin(1, 0);

        this.add.text(
            988,
            68,
            'Presencia sincronizada · sin movimiento todavía',
            {
                fontFamily: 'Arial',
                fontSize: 12,
                color: '#64748b',
                align: 'right'
            }
        ).setOrigin(1, 0);

        this.add.rectangle(
            512,
            438,
            960,
            600,
            0x020617,
            0.38
        )
            .setStrokeStyle(
                1,
                0x1e293b,
                0.9
            );

        this.errorText = this.add.text(
            512,
            134,
            '',
            {
                fontFamily: 'Arial',
                fontSize: 16,
                color: '#fda4af',
                backgroundColor: '#4c0519cc',
                padding: {
                    x: 10,
                    y: 5
                },
                align: 'center'
            }
        )
            .setOrigin(0.5)
            .setVisible(false);

        this.add.text(
            512,
            730,
            'Movimiento, disparos y combate se construirán durante la clase.',
            {
                fontFamily: 'Arial',
                fontSize: 14,
                color: '#64748b'
            }
        ).setOrigin(0.5);

        // =========================
        // COLOR
        // =========================

        this.colorInput =
            document.createElement('input');

        this.colorInput.type = 'text';
        this.colorInput.placeholder = '#RRGGBB';
        this.colorInput.value = '#FFFFFF';
        this.colorInput.maxLength = 7;

        this.colorInput.style.position =
            'absolute';

        this.colorInput.style.left =
            '36px';

        this.colorInput.style.top =
            '115px';

        this.colorInput.style.width =
            '120px';

        this.colorInput.style.padding =
            '6px';

        this.colorInput.style.fontSize =
            '14px';

        this.colorInput.style.fontFamily =
            'Arial';

        this.colorInput.style.backgroundColor =
            '#0f172a';

        this.colorInput.style.color =
            '#f8fafc';

        this.colorInput.style.border =
            '1px solid #334155';

        this.colorInput.style.borderRadius =
            '4px';

        document.body.appendChild(
            this.colorInput
        );

        const applyColorButton =
            document.createElement('button');

        applyColorButton.textContent =
            'Aplicar color';

        applyColorButton.style.position =
            'absolute';

        applyColorButton.style.left =
            '165px';

        applyColorButton.style.top =
            '115px';

        applyColorButton.style.padding =
            '6px 10px';

        applyColorButton.style.fontSize =
            '14px';

        applyColorButton.style.fontFamily =
            'Arial';

        applyColorButton.style.backgroundColor =
            '#2563eb';

        applyColorButton.style.color =
            '#ffffff';

        applyColorButton.style.border =
            'none';

        applyColorButton.style.borderRadius =
            '4px';

        applyColorButton.style.cursor =
            'pointer';

        document.body.appendChild(
            applyColorButton
        );

        // =========================
        // USERNAME
        // =========================

        this.usernameInput =
            document.createElement('input');

        this.usernameInput.type = 'text';
        this.usernameInput.placeholder =
            'Username';

        this.usernameInput.maxLength =
            16;

        this.usernameInput.style.position =
            'absolute';

        this.usernameInput.style.left =
            '36px';

        this.usernameInput.style.top =
            '155px';

        this.usernameInput.style.width =
            '120px';

        this.usernameInput.style.padding =
            '6px';

        this.usernameInput.style.fontSize =
            '14px';

        this.usernameInput.style.fontFamily =
            'Arial';

        this.usernameInput.style.backgroundColor =
            '#0f172a';

        this.usernameInput.style.color =
            '#f8fafc';

        this.usernameInput.style.border =
            '1px solid #334155';

        this.usernameInput.style.borderRadius =
            '4px';

        document.body.appendChild(
            this.usernameInput
        );

        const applyUsernameButton =
            document.createElement('button');

        applyUsernameButton.textContent =
            'Aplicar nombre';

        applyUsernameButton.style.position =
            'absolute';

        applyUsernameButton.style.left =
            '165px';

        applyUsernameButton.style.top =
            '155px';

        applyUsernameButton.style.padding =
            '6px 10px';

        applyUsernameButton.style.fontSize =
            '14px';

        applyUsernameButton.style.fontFamily =
            'Arial';

        applyUsernameButton.style.backgroundColor =
            '#2563eb';

        applyUsernameButton.style.color =
            '#ffffff';

        applyUsernameButton.style.border =
            'none';

        applyUsernameButton.style.borderRadius =
            '4px';

        applyUsernameButton.style.cursor =
            'pointer';

        document.body.appendChild(
            applyUsernameButton
        );

        // =========================
        // SKIN
        // =========================

        this.skinInput =
            document.createElement('input');

        this.skinInput.type = 'file';

        this.skinInput.accept =
            'image/png,image/jpeg,image/webp';

        this.skinInput.style.position =
            'absolute';

        this.skinInput.style.left =
            '36px';

        this.skinInput.style.top =
            '195px';

        this.skinInput.style.width =
            '250px';

        this.skinInput.style.fontSize =
            '14px';

        this.skinInput.style.fontFamily =
            'Arial';

        this.skinInput.style.color =
            '#f8fafc';

        document.body.appendChild(
            this.skinInput
        );

        const applySkinButton =
            document.createElement('button');

        applySkinButton.textContent =
            'Usar skin';

        applySkinButton.style.position =
            'absolute';

        applySkinButton.style.left =
            '295px';

        applySkinButton.style.top =
            '193px';

        applySkinButton.style.padding =
            '6px 10px';

        applySkinButton.style.fontSize =
            '14px';

        applySkinButton.style.fontFamily =
            'Arial';

        applySkinButton.style.backgroundColor =
            '#2563eb';

        applySkinButton.style.color =
            '#ffffff';

        applySkinButton.style.border =
            'none';

        applySkinButton.style.borderRadius =
            '4px';

        applySkinButton.style.cursor =
            'pointer';

        document.body.appendChild(
            applySkinButton
        );

        // =========================
        // BOTÓN USERNAME
        // =========================

        applyUsernameButton.addEventListener(
            'click',
            () =>
            {
                const username =
                    this.usernameInput.value.trim();

                if (
                    !/^[A-Za-z][A-Za-z0-9_]{2,15}$/
                        .test(username)
                )
                {
                    this.errorText
                        .setText(
                            'Nombre inválido. Usa 3-16 caracteres.'
                        )
                        .setVisible(true);

                    return;
                }

                this.errorText
                    .setVisible(false);

                const payload:
                    SetUsernamePayload = {
                        username
                    };

                this.socket.emit(
                    SOCKET_EVENTS.PROFILE_USERNAME_SET,
                    payload
                );
            }
        );

        // =========================
        // BOTÓN COLOR
        // =========================

        applyColorButton.addEventListener(
            'click',
            () =>
            {
                const colorHex =
                    this.colorInput.value.trim();

                if (
                    !/^#[0-9A-Fa-f]{6}$/
                        .test(colorHex)
                )
                {
                    this.errorText
                        .setText(
                            'Color inválido. Usa #RRGGBB.'
                        )
                        .setVisible(true);

                    return;
                }

                this.errorText
                    .setVisible(false);

                this.setPlayerColor(
                    colorHex
                );
            }
        );

        // =========================
        // BOTÓN SKIN
        // =========================

        applySkinButton.addEventListener(
            'click',
            () =>
            {
                const file =
                    this.skinInput.files?.[0];

                if (!file)
                {
                    this.errorText
                        .setText(
                            'Selecciona una imagen primero.'
                        )
                        .setVisible(true);

                    return;
                }

                this.uploadSkin(file);
            }
        );
    }

    private attachSocketListeners()
    {
        this.socket.on(
            'connect',
            this.handleConnect
        );

        this.socket.on(
            'disconnect',
            this.handleDisconnect
        );

        this.socket.on(
            SOCKET_EVENTS.ROOM_STATE,
            this.handleRoomState
        );

        this.socket.on(
            SOCKET_EVENTS.ROOM_ERROR,
            this.handleRoomError
        );

        this.socket.on(
            SOCKET_EVENTS.PLAYER_JOINED,
            this.handlePlayerJoined
        );

        this.socket.on(
            SOCKET_EVENTS.PLAYER_LEFT,
            this.handlePlayerLeft
        );

        this.socket.on(
            SOCKET_EVENTS.PLAYER_APPEARANCE_CHANGED,
            this.handlePlayerAppearanceChanged
        );

        this.socket.on(
            SOCKET_EVENTS.PLAYER_USERNAME_CHANGED,
            this.handlePlayerUsernameChanged
        );
    }

    private detachSocketListeners()
    {
        this.socket.off(
            'connect',
            this.handleConnect
        );

        this.socket.off(
            'disconnect',
            this.handleDisconnect
        );

        this.socket.off(
            SOCKET_EVENTS.ROOM_STATE,
            this.handleRoomState
        );

        this.socket.off(
            SOCKET_EVENTS.ROOM_ERROR,
            this.handleRoomError
        );

        this.socket.off(
            SOCKET_EVENTS.PLAYER_JOINED,
            this.handlePlayerJoined
        );

        this.socket.off(
            SOCKET_EVENTS.PLAYER_LEFT,
            this.handlePlayerLeft
        );

        this.socket.off(
            SOCKET_EVENTS.PLAYER_APPEARANCE_CHANGED,
            this.handlePlayerAppearanceChanged
        );

        this.socket.off(
            SOCKET_EVENTS.PLAYER_USERNAME_CHANGED,
            this.handlePlayerUsernameChanged
        );
    }

    private joinRoom()
    {
        const payload:
            JoinRoomPayload = {
                roomId: this.identity.roomId,
                playerName:
                    this.identity.playerName,
                profileId:
                    this.identity.profileId
            };

        this.errorText
            .setVisible(false);

        this.socket.emit(
            SOCKET_EVENTS.ROOM_JOIN,
            payload
        );
    }

    private setPlayerColor(
        colorHex: string
    )
    {
        this.socket.emit(
            SOCKET_EVENTS.PROFILE_APPEARANCE_SET,
            {
                appearance: {
                    mode: 'color',
                    colorHex
                }
            }
        );
    }

    private async uploadSkin(
        file: File
    )
    {
        this.errorText
            .setVisible(false);

        const formData =
            new FormData();

        formData.append(
            'skin',
            file
        );

        try
        {
            const response =
                await fetch(
                    `${serverUrl}/api/skins`,
                    {
                        method: 'POST',
                        body: formData
                    }
                );

            if (!response.ok)
            {
                const result =
                    await response.json()
                        .catch(
                            () => undefined
                        );

                throw new Error(
                    result?.error ??
                    'No se pudo subir la skin.'
                );
            }

            const skin =
                await response.json();

            this.socket.emit(
                SOCKET_EVENTS.PROFILE_APPEARANCE_SET,
                {
                    appearance: {
                        mode: 'skin',
                        colorHex:
                            this.colorInput.value.trim(),
                        skin
                    }
                }
            );
        }
        catch (error)
        {
            this.errorText
                .setText(
                    error instanceof Error
                        ? error.message
                        : 'Error al subir la skin.'
                )
                .setVisible(true);
        }
    }

    private readonly handleConnect = () =>
    {
        this.setConnectionStatus(
            'connected'
        );

        this.joinRoom();
    };

    private readonly handleDisconnect = () =>
    {
        this.setConnectionStatus(
            'disconnected'
        );

        this.playerRegistry
            .replaceAll([]);

        this.selfId = '';

        this.syncPlayerViews();
    };

    private readonly handleRoomState = (
        payload: RoomStatePayload
    ) =>
    {
        this.roomText.setText(
            `Sala: ${payload.roomId}`
        );

        this.selfId =
            payload.selfId;

        this.playerRegistry
            .replaceAll(
                payload.players
            );

        const selfPlayer =
            payload.players.find(
                (player) =>
                    player.id ===
                    payload.selfId
            );

        if (selfPlayer)
        {
            this.colorInput.value =
                selfPlayer.appearance.colorHex;

            this.usernameInput.value =
                selfPlayer.name;
        }

        this.syncPlayerViews();
    };

    private readonly handleRoomError = (
        payload: RoomErrorPayload
    ) =>
    {
        this.errorText
            .setText(
                `${payload.code}: ${payload.message}`
            )
            .setVisible(true);
    };

    private readonly handlePlayerJoined = (
        payload: PlayerJoinedPayload
    ) =>
    {
        this.playerRegistry.add(
            payload.player
        );

        this.upsertPlayerView(
            payload.player
        );

        this.updatePlayerCount();
    };

    private readonly handlePlayerLeft = (
        payload: PlayerLeftPayload
    ) =>
    {
        this.playerRegistry.remove(
            payload.playerId
        );

        const view =
            this.playerViews.get(
                payload.playerId
            );

        if (view)
        {
            view.destroy();

            this.playerViews.delete(
                payload.playerId
            );
        }

        this.updatePlayerCount();
    };

    private readonly handlePlayerAppearanceChanged = (
        payload: PlayerAppearanceChangedPayload
    ) =>
    {
        const player =
            this.playerRegistry.get(
                payload.playerId
            );

        if (!player)
        {
            return;
        }

        const updatedPlayer = {
            ...player,
            appearance:
                payload.appearance
        };

        this.playerRegistry.add(
            updatedPlayer
        );

        this.upsertPlayerView(
            updatedPlayer
        );

        if (
            payload.playerId ===
            this.selfId
        )
        {
            this.colorInput.value =
                payload.appearance.colorHex;
        }
    };

    private readonly handlePlayerUsernameChanged = (
        payload: PlayerUsernameChangedPayload
    ) =>
    {
        const player =
            this.playerRegistry.get(
                payload.playerId
            );

        if (!player)
        {
            return;
        }

        const updatedPlayer = {
            ...player,
            name:
                payload.username
        };

        this.playerRegistry.add(
            updatedPlayer
        );

        this.upsertPlayerView(
            updatedPlayer
        );

        if (
            payload.playerId ===
            this.selfId
        )
        {
            this.usernameInput.value =
                payload.username;
        }
    };

    private syncPlayerViews()
    {
        const activeIds =
            new Set(
                this.playerRegistry
                    .getAll()
                    .map(
                        (player) =>
                            player.id
                    )
            );

        for (
            const [
                playerId,
                view
            ] of this.playerViews
        )
        {
            if (
                !activeIds.has(
                    playerId
                )
            )
            {
                view.destroy();

                this.playerViews.delete(
                    playerId
                );
            }
        }

        for (
            const player
            of this.playerRegistry.getAll()
        )
        {
            this.upsertPlayerView(
                player
            );
        }

        this.updatePlayerCount();
    }

    private upsertPlayerView(
        player: PlayerState
    )
    {
        const existing =
            this.playerViews.get(
                player.id
            );

        if (existing)
        {
            existing.update(player);
            return;
        }

        const view =
            new PlayerView(
                this,
                player,
                player.id === this.selfId
            );

        this.playerViews.set(
            player.id,
            view
        );
    }

    private clearPlayerViews()
    {
        for (
            const view
            of this.playerViews.values()
        )
        {
            view.destroy();
        }

        this.playerViews.clear();

        this.playerRegistry
            .replaceAll([]);
    }

    private updatePlayerCount()
    {
        this.playerCountText.setText(
            `Players: ${this.playerRegistry.size}`
        );
    }

    private setConnectionStatus(
        status: ConnectionStatus
    )
    {
        const labels: Record<
            ConnectionStatus,
            string
        > = {
            connecting:
                '● CONNECTING',

            connected:
                '● CONNECTED',

            disconnected:
                '● DISCONNECTED'
        };

        const colors: Record<
            ConnectionStatus,
            string
        > = {
            connecting:
                '#facc15',

            connected:
                '#4ade80',

            disconnected:
                '#fb7185'
        };

        this.connectionText.setText(
            labels[status]
        );

        this.connectionText.setColor(
            colors[status]
        );
    }
}

