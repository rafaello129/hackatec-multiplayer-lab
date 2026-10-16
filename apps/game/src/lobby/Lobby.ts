import { SOCKET_EVENTS, type CombatSnapshot, type RoomStatePayload, type ConnectionReadyPayload } from '@hackatec/shared';
import { getClientIdentity } from '../network/identity';
import { getSocket, leaveSession } from '../network/socket';
import { invitationUrl, roomCode } from './links';
import { joinFromLobby } from './join';

export function showLobby(initialMessage = '') {
    document.body.classList.add('in-lobby');
    const main = document.createElement('main');
    main.className = 'lobby';
    main.innerHTML = `
        <section class="lobby-card" aria-labelledby="lobby-title">
            <p class="eyebrow">HACKATEC · MULTIPLAYER LAB</p>
            <h1 id="lobby-title">Tu próxima partida<br>empieza aquí.</h1>
            <p class="lobby-description">Crea una sala e invita a tu equipo, o entra con el código que te compartieron.</p>
            <form>
                <label for="player-name">Tu nombre</label>
                <input id="player-name" name="playerName" maxlength="20" required autocomplete="nickname" placeholder="¿Cómo te llamas?">
                <label for="room-code">Código de sala</label>
                <input id="room-code" name="roomId" maxlength="32" required autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Por ejemplo: equipo-1">
                <p class="field-help">Hasta 32 letras, números, guiones o guiones bajos. Una sala vacía se crea al entrar.</p>
                <div class="lobby-actions">
                    <button type="submit">Entrar a la sala</button>
                    <button type="button" class="secondary" data-create>Crear sala nueva</button>
                </div>
                <p role="status" aria-live="polite" class="lobby-status"></p>
            </form>
            <p class="lobby-footer">WASD / flechas · Shift para dash · Clic para disparar · 1 / 2 / 3 para armas</p>
        </section>`;
    document.body.append(main);
    const form = main.querySelector('form')!;
    const name = main.querySelector<HTMLInputElement>('#player-name')!;
    const room = main.querySelector<HTMLInputElement>('#room-code')!;
    const status = main.querySelector<HTMLElement>('[role=status]')!;
    status.textContent = initialMessage;
    const create = main.querySelector<HTMLButtonElement>('[data-create]')!;
    const buttons = main.querySelectorAll<HTMLButtonElement>('button');
    const submit = main.querySelector<HTMLButtonElement>('button[type=submit]')!;
    let reloadRequired = Boolean(initialMessage);
    if (reloadRequired) submit.textContent = 'Recargar y entrar';
    const params = new URLSearchParams(location.search);
    room.value = params.get('room') ?? '';
    name.value = params.get('name') ?? '';
    create.onclick = () => {
        room.value = roomCode();
        status.textContent = 'Código nuevo listo. Entra para crear la sala.';
        if (!name.value.trim()) name.focus();
        else form.requestSubmit();
    };
    let busy = false;
    form.onsubmit = async event => {
        event.preventDefault();
        if (busy) return;
        const roomId = room.value.trim();
        const playerName = name.value.trim();
        if (!playerName || !/^[A-Za-z0-9_-]{1,32}$/.test(roomId)) {
            status.textContent = !playerName ? 'Escribe tu nombre.' : 'Código inválido: usa letras, números, guiones o guiones bajos.';
            return;
        }
        if (reloadRequired) {
            // Browsers cache failed module downloads. A new document permits a retry.
            const retryUrl = new URL(location.href);
            retryUrl.searchParams.set('room', roomId);
            retryUrl.searchParams.set('name', playerName);
            location.assign(retryUrl.href);
            return;
        }
        busy = true;
        buttons.forEach(button => button.disabled = true);
        name.disabled = room.disabled = true;
        status.textContent = 'Conectando con la sala…';
        let loaded = false;
        try {
            // Load before joining so the initial snapshot is handed directly to the scene.
            const { startGame } = await import('../game/main');
            loaded = true;
            const identity = getClientIdentity('');
            const state = await joinFromLobby(getSocket(), { roomId, playerName, profileId: identity.profileId });
            const url = new URL(location.href);
            url.searchParams.set('room', roomId);
            url.searchParams.set('name', playerName);
            history.replaceState(null, '', url);
            startGame('game-container', state);
            main.remove();
            document.body.classList.remove('in-lobby');
            showRoomTools(state.roomId);
        } catch (error) {
            reloadRequired = !loaded;
            if (reloadRequired) submit.textContent = 'Recargar y entrar';
            status.textContent = !loaded ? 'No se pudo cargar el juego. Recupera la conexión y pulsa «Recargar y entrar».' :
                error instanceof Error ? error.message : 'No se pudo entrar a la sala.';
            busy = false;
            buttons.forEach(button => button.disabled = false);
            name.disabled = room.disabled = false;
        }
    };
    name.focus();
}

export function showRoomTools(initialRoom: string) {
    const toolbar = document.createElement('aside');
    toolbar.className = 'room-tools';
    toolbar.setAttribute('aria-label', 'Sala e invitación');
    toolbar.innerHTML = `<strong class="game-brand">H<span> / </span>HACKATEC</strong><span data-room></span><span data-count></span><button type="button">Invitar</button><a href="${location.pathname}">Volver al lobby</a><label hidden>Enlace de invitación<input readonly aria-label="Enlace de invitación"></label><span role="status" aria-live="polite"></span>`;
    document.body.append(toolbar);
    let currentRoom = initialRoom;
    const room = toolbar.querySelector<HTMLElement>('[data-room]')!;
    const count = toolbar.querySelector<HTMLElement>('[data-count]')!;
    const status = toolbar.querySelector<HTMLElement>('[role=status]')!;
    const label = toolbar.querySelector('label')!;
    const input = toolbar.querySelector('input')!;
    room.textContent = `Sala: ${currentRoom}`;
    const socket = getSocket();
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const notice = (message: string, persistent = false) => {
        clearTimeout(noticeTimer);
        status.textContent = message;
        if (!persistent) noticeTimer = setTimeout(() => { status.textContent = ''; }, 4500);
    };
    toolbar.querySelector('a')!.onclick = event => {
        event.preventDefault();
        leaveSession();
        location.assign(location.pathname);
    };
    let interrupted = false;
    socket.on(SOCKET_EVENTS.CONNECTION_READY, (ready: ConnectionReadyPayload) => {
        if (ready.recovered) notice('Conexión recuperada. Continúas tu partida.');
        else if (interrupted) notice('La sesión anterior terminó. Entras con un jugador nuevo.');
        interrupted = false;
    });
    socket.on(SOCKET_EVENTS.ROOM_STATE, (state: RoomStatePayload) => {
        currentRoom = state.roomId;
        room.textContent = `Sala: ${currentRoom}`;
        count.textContent = `${state.players.length} jugadores`;
    });
    socket.on(SOCKET_EVENTS.COMBAT_STATE, (state: CombatSnapshot) => {
        const offline = state.players.filter(player => player.connected === false).length;
        count.textContent = `${state.players.length} jugadores${offline ? ` · ${offline} reconectando` : ''}`;
    });
    socket.on('disconnect', () => {
        interrupted = true;
        count.textContent = 'Reconectando…';
        notice('Intentando recuperar tu partida. La plaza se conserva durante 30 segundos.', true);
    });
    toolbar.querySelector('button')!.onclick = async () => {
        if (!label.hidden) { label.hidden = true; return; }
        input.value = invitationUrl(location.href, currentRoom);
        label.hidden = false;
        try {
            await navigator.clipboard.writeText(input.value);
            label.hidden = true;
            notice('Invitación copiada.');
        } catch {
            input.focus();
            input.select();
            notice('Copia el enlace seleccionado para invitar.');
        }
    };
}
