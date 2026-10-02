import { Scene, type GameObjects } from 'phaser';
import type { Socket } from 'socket.io-client';
import { getSocket, serverUrl } from '../../network/socket';

export class BootScene extends Scene
{
    private statusText!: GameObjects.Text;
    private socket?: Socket;
    private started = false;

    constructor()
    {
        super('BootScene');
    }

    create()
    {
        this.started = false;
        this.cameras.main.setBackgroundColor('#07111f');

        this.add.text(512, 250, 'HACKATEC MULTIPLAYER LAB', {
            fontFamily: 'Arial Black',
            fontSize: 38,
            color: '#f8fafc',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(512, 315, 'Fase 1 · Entrando al servidor multijugador', {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#94a3b8'
        }).setOrigin(0.5);

        this.statusText = this.add.text(512, 395, 'Servidor: conectando…', {
            fontFamily: 'Arial Black',
            fontSize: 25,
            color: '#facc15',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(512, 460, `Servidor: ${serverUrl}`, {
            fontFamily: 'Arial',
            fontSize: 16,
            color: '#64748b'
        }).setOrigin(0.5);

        this.socket = getSocket();
        this.socket.on('connect', this.handleConnect);
        this.socket.on('connect_error', this.handleConnectError);

        this.events.once('shutdown', () =>
        {
            this.socket?.off('connect', this.handleConnect);
            this.socket?.off('connect_error', this.handleConnectError);
        });

        if (this.socket.connected)
        {
            this.handleConnect();
        }
        else
        {
            this.socket.connect();
        }
    }

    private readonly handleConnect = () =>
    {
        this.statusText.setText('Servidor: conectado');
        this.statusText.setColor('#4ade80');

        if (this.started)
        {
            return;
        }

        this.started = true;

        this.time.delayedCall(180, () =>
        {
            this.scene.start('ArenaScene');
        });
    };

    private readonly handleConnectError = () =>
    {
        this.statusText.setText('Servidor: desconectado');
        this.statusText.setColor('#fb7185');
    };
}
