import {
    SOCKET_EVENTS,
    type ConnectionReadyPayload,
    type ConnectionStatus
} from '@hackatec/shared';
import { Scene, type GameObjects } from 'phaser';
import type { Socket } from 'socket.io-client';
import { createSocket, serverUrl } from '../../network/socket';

export class BootScene extends Scene
{
    private statusText!: GameObjects.Text;
    private socket?: Socket;

    constructor()
    {
        super('BootScene');
    }

    create()
    {
        this.cameras.main.setBackgroundColor('#07111f');

        this.add.text(512, 240, 'HACKATEC MULTIPLAYER LAB', {
            fontFamily: 'Arial Black',
            fontSize: 38,
            color: '#f8fafc',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(512, 305, 'Fase 0 · Infraestructura y conexión', {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#94a3b8'
        }).setOrigin(0.5);

        this.statusText = this.add.text(512, 390, '', {
            fontFamily: 'Arial Black',
            fontSize: 25,
            color: '#facc15',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(512, 458, `Servidor: ${serverUrl}`, {
            fontFamily: 'Arial',
            fontSize: 16,
            color: '#64748b'
        }).setOrigin(0.5);

        this.add.text(512, 540, 'El gameplay comienza en la siguiente fase.', {
            fontFamily: 'Arial',
            fontSize: 17,
            color: '#cbd5e1'
        }).setOrigin(0.5);

        this.setConnectionStatus('connecting');

        const socket = createSocket();
        this.socket = socket;

        socket.on('connect', () =>
        {
            this.setConnectionStatus('connected');
        });

        socket.on(
            SOCKET_EVENTS.CONNECTION_READY,
            (payload: ConnectionReadyPayload) =>
            {
                console.log(
                    `[game] server ready: ${payload.message} (${payload.socketId})`
                );
            }
        );

        socket.on('disconnect', () =>
        {
            this.setConnectionStatus('disconnected');
        });

        socket.on('connect_error', (error) =>
        {
            console.error('[game] connection error:', error.message);
            this.setConnectionStatus('disconnected');
        });

        socket.connect();

        this.events.once('shutdown', () =>
        {
            socket.disconnect();
        });
    }

    private setConnectionStatus(status: ConnectionStatus)
    {
        const labels: Record<ConnectionStatus, string> = {
            connecting: 'Servidor: conectando…',
            connected: 'Servidor: conectado',
            disconnected: 'Servidor: desconectado'
        };

        const colors: Record<ConnectionStatus, string> = {
            connecting: '#facc15',
            connected: '#4ade80',
            disconnected: '#fb7185'
        };

        this.statusText.setText(labels[status]);
        this.statusText.setColor(colors[status]);
    }
}
