import './style.css';
import { showLobby, showRoomTools } from './lobby/Lobby';

const params = new URLSearchParams(location.search);
if (params.get('room')?.trim() && params.get('name')?.trim()) {
    // Existing classroom links continue to enter directly.
    void import('./game/main').then(({ startGame }) => {
        startGame();
        showRoomTools(params.get('room')!.trim());
    }).catch(() => showLobby('No se pudo cargar el juego. Comprueba la conexión y vuelve a intentarlo.'));
} else {
    showLobby();
}
