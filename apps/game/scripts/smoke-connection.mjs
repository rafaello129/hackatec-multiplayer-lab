import { io } from 'socket.io-client';

const url = process.env.VITE_SERVER_URL || 'http://127.0.0.1:3001';
const sockets = [];
const suffix = String(Date.now()).slice(-6);
const password = 'Smoke-test-Password-123!';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function waitFor(socket, event, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`Timed out waiting for ${event}`));
        }, timeoutMs);
        const handler = (payload) => {
            clearTimeout(timeout);
            resolve(payload);
        };
        socket.once(event, handler);
    });
}

function waitForCombatPlayer(socket, playerId, spectator, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off('combat:state', handler);
            reject(new Error('Timed out waiting for player combat state'));
        }, timeoutMs);
        const handler = (payload) => {
            const player = payload?.players?.find(item => item.id === playerId);
            if (!player || player.spectator !== spectator) return;
            clearTimeout(timeout);
            socket.off('combat:state', handler);
            resolve(player);
        };
        socket.on('combat:state', handler);
    });
}

function waitForCombatRoster(socket, count, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off('combat:state', handler);
            reject(new Error('Timed out waiting for the full combat roster'));
        }, timeoutMs);
        const handler = (payload) => {
            if ((payload?.players?.length ?? 0) < count) return;
            clearTimeout(timeout);
            socket.off('combat:state', handler);
            resolve(payload);
        };
        socket.on('combat:state', handler);
    });
}

function waitForPlayerMoved(socket, playerId, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off('player:moved', handler);
            reject(new Error('Timed out waiting for authoritative movement update'));
        }, timeoutMs);
        const handler = (payload) => {
            if (payload?.player?.id !== playerId) return;
            clearTimeout(timeout);
            socket.off('player:moved', handler);
            resolve(payload.player);
        };
        socket.on('player:moved', handler);
    });
}


function waitForMatchVote(socket, playerId, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off('match:state', handler);
            reject(new Error('Timed out waiting for registered vote'));
        }, timeoutMs);
        const handler = (payload) => {
            if (payload?.votes?.[playerId] !== 'classic') return;
            clearTimeout(timeout);
            socket.off('match:state', handler);
            resolve(payload);
        };
        socket.on('match:state', handler);
    });
}

function waitForMatchPhase(socket, phase, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off('match:state', handler);
            reject(new Error(`Timed out waiting for match phase ${phase}`));
        }, timeoutMs);
        const handler = (payload) => {
            if (payload?.phase !== phase) return;
            clearTimeout(timeout);
            socket.off('match:state', handler);
            resolve(payload);
        };
        socket.on('match:state', handler);
    });
}

async function createAccount(label) {
    const username = label === 'Gueta' ? 'Gueta' : `${label}${suffix}`;
    const response = await fetch(`${url}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const body = await response.json();
    assert(response.status === 201, `could not register smoke account ${label}: ${body.error}`);
    assert(!Object.hasOwn(body.account ?? {}, 'isOwner'), 'owner status must not be exposed to the client');
    const setCookie = response.headers.get('set-cookie');
    assert(Boolean(setCookie), `registration did not issue a session cookie for ${label}`);
    return { username, cookie: setCookie.split(';')[0] };
}


async function loginAccount(username) {
    const response = await fetch(`${url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const body = await response.json();
    assert(response.status === 200, `could not log in smoke account: ${body.error}`);
    const setCookie = response.headers.get('set-cookie');
    assert(Boolean(setCookie), 'login did not issue a session cookie');
    return setCookie.split(';')[0];
}

async function verifyAuthApi(account) {
    const sessionResponse = await fetch(`${url}/api/auth/session`, {
        headers: { Cookie: account.cookie },
        cache: 'no-store'
    });
    const session = await sessionResponse.json();
    assert(sessionResponse.status === 200, 'registered account session could not be recovered');
    assert(session.account?.username === account.username, 'session endpoint returned the wrong account');

    const meResponse = await fetch(`${url}/api/auth/me`, {
        headers: { Cookie: account.cookie },
        cache: 'no-store'
    });
    const me = await meResponse.json();
    assert(meResponse.status === 200 && me.account?.id === session.account?.id,
        'the /api/auth/me alias should resolve the same authenticated account');

    const wrongPasswordResponse = await fetch(`${url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: account.username, password: 'Wrong-password-123!' })
    });
    const wrongPassword = await wrongPasswordResponse.json();
    const missingUserResponse = await fetch(`${url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: `Missing${suffix}`, password: 'Wrong-password-123!' })
    });
    const missingUser = await missingUserResponse.json();
    assert(wrongPasswordResponse.status === 401 && missingUserResponse.status === 401,
        'invalid credentials should return the same status');
    assert(wrongPassword.error === missingUser.error,
        'login errors must not reveal whether a username exists');
}

async function verifyUnauthenticatedSocketIsRejected() {
    const socket = io(url, { transports: ['websocket', 'polling'], timeout: 5000 });
    sockets.push(socket);
    const rejected = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('unauthenticated socket was not rejected')), 5000);
        socket.once('connect_error', (error) => {
            clearTimeout(timeout);
            resolve(error);
        });
        socket.once('connect', () => {
            clearTimeout(timeout);
            reject(new Error('unauthenticated socket unexpectedly connected'));
        });
    });
    assert(String(rejected?.message).includes('UNAUTHORIZED'), 'unauthenticated socket returned an unexpected error');
    socket.disconnect();
    console.log('[smoke] unauthenticated Socket.IO access rejected');
}

async function connectClient(label, cookie) {
    const socket = io(url, {
        transports: ['polling', 'websocket'],
        timeout: 5000,
        extraHeaders: { Cookie: cookie },
        withCredentials: true
    });
    sockets.push(socket);
    const readyPromise = waitFor(socket, 'connection:ready');
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`${label} timed out connecting`)), 5000);
        socket.once('connect', () => {
            clearTimeout(timeout);
            resolve();
        });
        socket.once('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
    const ready = await readyPromise;
    assert(ready?.message === 'connected', `${label} received invalid ready payload`);
    assert(Boolean(ready?.socketId), `${label} did not receive a socket id`);
    console.log(`[smoke] ${label} authenticated and connected: ${socket.id}`);
    return socket;
}

async function joinRoom(socket, roomId) {
    const statePromise = waitFor(socket, 'room:state');
    socket.emit('room:join', { roomId });
    return statePromise;
}

async function main() {
    await verifyUnauthenticatedSocketIsRejected();

    // The first successful registration of Gueta claims owner status; no client-supplied key is used.
    const ownerAccount = await createAccount('Gueta');
    assert(ownerAccount.username === 'Gueta', 'owner account username was changed unexpectedly');

    const alphaAccount = await createAccount('Alpha');
    const betaAccount = await createAccount('Beta');
    const gammaAccount = await createAccount('Gamma');
    const deltaAccount = await createAccount('Delta');
    await verifyAuthApi(alphaAccount);
    const betaLoginCookie = await loginAccount(betaAccount.username);

    const alpha = await connectClient('alpha', alphaAccount.cookie);
    const alphaState = await joinRoom(alpha, 'hackatec');
    assert(alphaState.roomId === 'hackatec', 'alpha joined the wrong room');
    assert(alphaState.players.length === 1, 'alpha should initially be alone');
    assert(alphaState.players[0]?.name === alphaAccount.username, 'server did not use the authenticated username');

    const alphaSawJoin = waitFor(alpha, 'player:joined');
    const alphaVoting = waitForMatchPhase(alpha, 'voting');
    const beta = await connectClient('beta', betaLoginCookie);
    const betaVoting = waitForMatchPhase(beta, 'voting');
    const betaState = await joinRoom(beta, 'hackatec');
    const publicChatPromise = waitFor(beta, 'chat:message');
    alpha.emit('chat:send', { channel: 'all', text: '  Hola' + String.fromCharCode(0) + ' desde smoke  ' });
    const publicChat = await publicChatPromise;
    assert(publicChat.channel === 'all' && publicChat.text === 'Hola desde smoke',
        'public chat should be sanitized and broadcast to room members');
    const joined = await alphaSawJoin;
    const votingState = await alphaVoting;
    const betaMatchState = await betaVoting;

    assert(betaState.players.length === 2, 'beta should receive a two-player snapshot');
    assert(betaState.hostId === alpha.id, 'the first player should be the room host');
    assert(votingState.phase === 'voting' && betaMatchState.phase === 'voting', 'two players should trigger a shared vote');
    const voteStatePromise = waitForMatchVote(beta, beta.id);
    beta.emit('match:vote', { mode: 'classic' });
    const voteState = await voteStatePromise;
    assert(voteState.votes[beta.id] === 'classic', 'player vote should be synchronized to the room');

    const alphaCountdown = waitForMatchPhase(alpha, 'countdown');
    alpha.emit('match:host-start', { mode: 'classic' });
    const forcedStart = await alphaCountdown;
    assert(forcedStart.mode === 'classic', 'host should be able to force Classic mode');

    const alphaPlaying = waitForMatchPhase(alpha, 'playing', 10000);
    await alphaPlaying;
    const delta = await connectClient('delta', deltaAccount.cookie);
    const deltaState = await joinRoom(delta, 'hackatec');
    const latePlayer = deltaState.players.find(player => player.id === delta.id);
    assert(latePlayer?.spectator === true, 'a player joining during a match must enter as a spectator');
    const spectatorChatPromise = waitFor(delta, 'chat:message');
    delta.emit('chat:send', { channel: 'spectators', text: 'Canal de espectadores' });
    const spectatorChat = await spectatorChatPromise;
    assert(spectatorChat.channel === 'spectators' && spectatorChat.senderId === delta.id,
        'spectator chat should be delivered in its private channel');

    const alphaStopped = waitForMatchPhase(alpha, 'waiting');
    alpha.emit('match:host-stop');
    await alphaStopped;

    const deltaReactivated = waitForCombatPlayer(delta, delta.id, false);
    const alphaRestarted = waitForMatchPhase(alpha, 'countdown');
    alpha.emit('match:host-start', { mode: 'classic' });
    await alphaRestarted;
    const reactivatedPlayer = await deltaReactivated;
    assert(reactivatedPlayer.spectator === false, 'spectators should become active when the next round is forced');

    const alphaStoppedAgain = waitForMatchPhase(alpha, 'waiting');
    alpha.emit('match:host-stop');
    await alphaStoppedAgain;
    assert(
        betaState.players.some((player) => player.name === alphaAccount.username) &&
        betaState.players.some((player) => player.name === betaAccount.username),
        'beta snapshot is missing authenticated room players'
    );
    assert(joined.player?.name === betaAccount.username, 'alpha did not observe beta joining');

    // Load acceptance: fill the room to its documented 32-player capacity.
    const loadClients = [];
    let finalLoadSnapshot;
    // One test account can open multiple authenticated sessions; this exercises
    // socket/player capacity without mass-registering accounts from one CI IP.
    const loadAccount = await createAccount('Load');
    for (let index = 0; index < 29; index += 1) {
        const loadSocket = await connectClient('load-' + index, loadAccount.cookie);
        const loadState = await joinRoom(loadSocket, 'hackatec');
        loadClients.push(loadSocket);
        finalLoadSnapshot = loadState;
        assert(loadState.players.length === index + 4,
            'room roster count is incorrect at load player ' + index);
    }
    assert(finalLoadSnapshot?.players.length === 32,
        'room should accept exactly 32 authenticated players');
    console.log('[smoke] 32 authenticated players joined a single room');

    // Exercise the live server tick with the full roster, not just idle connections.
    const loadCountdown = waitForMatchPhase(alpha, 'countdown', 10000);
    alpha.emit('match:host-start', { mode: 'classic' });
    await loadCountdown;
    const loadPlaying = waitForMatchPhase(alpha, 'playing', 10000);
    await loadPlaying;
    const fullRosterPromise = waitForCombatRoster(alpha, 32, 10000);
    const fullRoster = await fullRosterPromise;
    assert(fullRoster.players.length === 32, 'combat state must contain all 32 players');
    assert(fullRoster.players.every(player => player.spectator !== true),
        'all 32 players should be active at the start of the load round');

    const movingClient = loadClients[0];
    const movingPlayerId = movingClient.id;
    const movementPromise = waitForPlayerMoved(alpha, movingPlayerId);
    movingClient.emit('player:input', {
        input: { up: false, down: false, left: false, right: false, dash: true, aimAngle: 0 }
    });
    const movedPlayer = await movementPromise;
    assert(movedPlayer.isDashing === true && movedPlayer.isInvulnerable === true,
        'the authoritative tick should apply dash state under a 32-player load');

    const activeRoomSockets = [alpha, beta, delta, ...loadClients];
    const dashUpdates = new Set();
    const onDashUpdate = payload => {
        if (payload?.player?.id) dashUpdates.add(payload.player.id);
    };
    alpha.on('player:moved', onDashUpdate);
    for (const socket of activeRoomSockets) {
        if (socket.id === movingPlayerId) continue;
        socket.emit('player:input', {
            input: { up: false, down: false, left: false, right: false, dash: true, aimAngle: 0 }
        });
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    alpha.off('player:moved', onDashUpdate);
    assert(dashUpdates.size >= 31,
        'the server should process dash intents from the full active roster');

    let movementPacketsSent = 0;
    let movementCycles = 0;
    const stressInterval = setInterval(() => {
        const horizontal = movementCycles % 2 === 0;
        for (const socket of activeRoomSockets) {
            socket.emit('player:input', {
                input: {
                    up: false,
                    down: !horizontal,
                    left: false,
                    right: horizontal,
                    dash: false,
                    aimAngle: horizontal ? 0 : Math.PI / 2
                }
            });
            movementPacketsSent += 1;
        }
        movementCycles += 1;
    }, 50);
    const stressStartedAt = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1_500));
    clearInterval(stressInterval);
    const stressDurationMs = Date.now() - stressStartedAt;
    const stressSnapshot = await waitForCombatRoster(alpha, 32, 5000);
    assert(movementPacketsSent >= 32 * 20,
        '32-player movement stress should send at least 20 input rounds');
    assert(stressSnapshot.players.length === 32,
        'the 32-player roster should remain synchronized after movement stress');
    const inputRate = Math.round(movementPacketsSent * 1_000 / stressDurationMs);
    console.log('[smoke] 32-player movement stress: ' + movementPacketsSent +
        ' intents in ' + stressDurationMs + 'ms (~' + inputRate + ' intents/s)');

    const alphaLoadStopped = waitForMatchPhase(alpha, 'waiting', 10000);
    alpha.emit('match:host-stop');
    await alphaLoadStopped;
    console.log('[smoke] 32-player active combat tick and authoritative dash verified');

    const gamma = await connectClient('gamma', gammaAccount.cookie);
    const gammaState = await joinRoom(gamma, 'other-room');
    assert(gammaState.players.length === 1, 'other-room should be isolated');
    assert(gammaState.players[0]?.name === gammaAccount.username, 'other-room contains an unexpected player');

    const betaHostChanged = waitFor(beta, 'room:host-changed');
    const betaSawLeave = waitFor(beta, 'player:left');
    const alphaId = alpha.id;
    alpha.disconnect();
    const newHost = await betaHostChanged;
    assert(newHost.hostId === beta.id, 'host role should transfer to the longest-waiting player');
    const left = await betaSawLeave;
    assert(left.playerId === alphaId, 'beta did not observe the previous host leaving');
    beta.disconnect();
    delta.disconnect();
    for (const socket of loadClients) socket.disconnect();

    console.log('[smoke] authenticated same-room join/state/leave verified');
    console.log('[smoke] room isolation verified');

    gamma.disconnect();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('[smoke] failed:', error);
        for (const socket of sockets) socket.disconnect();
        process.exit(1);
    });
