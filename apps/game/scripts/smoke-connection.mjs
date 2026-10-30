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
    await verifyAuthApi(alphaAccount);
    const betaLoginCookie = await loginAccount(betaAccount.username);

    const alpha = await connectClient('alpha', alphaAccount.cookie);
    const alphaState = await joinRoom(alpha, 'hackatec');
    assert(alphaState.roomId === 'hackatec', 'alpha joined the wrong room');
    assert(alphaState.players.length === 1, 'alpha should initially be alone');
    assert(alphaState.players[0]?.name === alphaAccount.username, 'server did not use the authenticated username');

    const alphaSawJoin = waitFor(alpha, 'player:joined');
    const beta = await connectClient('beta', betaLoginCookie);
    const betaState = await joinRoom(beta, 'hackatec');
    const joined = await alphaSawJoin;

    assert(betaState.players.length === 2, 'beta should receive a two-player snapshot');
    assert(
        betaState.players.some((player) => player.name === alphaAccount.username) &&
        betaState.players.some((player) => player.name === betaAccount.username),
        'beta snapshot is missing authenticated room players'
    );
    assert(joined.player?.name === betaAccount.username, 'alpha did not observe beta joining');

    const gamma = await connectClient('gamma', gammaAccount.cookie);
    const gammaState = await joinRoom(gamma, 'other-room');
    assert(gammaState.players.length === 1, 'other-room should be isolated');
    assert(gammaState.players[0]?.name === gammaAccount.username, 'other-room contains an unexpected player');

    const alphaSawLeave = waitFor(alpha, 'player:left');
    const betaId = beta.id;
    beta.disconnect();
    const left = await alphaSawLeave;
    assert(left.playerId === betaId, 'alpha did not observe beta leaving');

    console.log('[smoke] authenticated same-room join/state/leave verified');
    console.log('[smoke] room isolation verified');

    alpha.disconnect();
    gamma.disconnect();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('[smoke] failed:', error);
        for (const socket of sockets) socket.disconnect();
        process.exit(1);
    });
