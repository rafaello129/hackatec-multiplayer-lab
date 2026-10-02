import { io } from 'socket.io-client';

const url = process.env.VITE_SERVER_URL || 'http://127.0.0.1:3001';
const sockets = [];

function assert(condition, message)
{
    if (!condition)
    {
        throw new Error(message);
    }
}

function waitFor(socket, event, timeoutMs = 5000)
{
    return new Promise((resolve, reject) =>
    {
        const timeout = setTimeout(() =>
        {
            socket.off(event, handler);
            reject(new Error(`Timed out waiting for ${event}`));
        }, timeoutMs);

        const handler = (payload) =>
        {
            clearTimeout(timeout);
            resolve(payload);
        };

        socket.once(event, handler);
    });
}

async function connectClient(label)
{
    const socket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: 5000
    });

    sockets.push(socket);

    const readyPromise = waitFor(socket, 'connection:ready');

    await new Promise((resolve, reject) =>
    {
        const timeout = setTimeout(
            () => reject(new Error(`${label} timed out connecting`)),
            5000
        );

        socket.once('connect', () =>
        {
            clearTimeout(timeout);
            resolve();
        });

        socket.once('connect_error', (error) =>
        {
            clearTimeout(timeout);
            reject(error);
        });
    });

    const ready = await readyPromise;

    assert(ready?.message === 'connected', `${label} received invalid ready payload`);
    assert(Boolean(ready?.socketId), `${label} did not receive a socket id`);

    console.log(`[smoke] ${label} connected: ${socket.id}`);

    return socket;
}

async function joinRoom(socket, roomId, playerName)
{
    const statePromise = waitFor(socket, 'room:state');

    socket.emit('room:join', {
        roomId,
        playerName
    });

    return statePromise;
}

async function main()
{
    const alpha = await connectClient('alpha');
    const alphaState = await joinRoom(alpha, 'hackatec', 'Alpha');

    assert(alphaState.roomId === 'hackatec', 'alpha joined the wrong room');
    assert(alphaState.players.length === 1, 'alpha should initially be alone');

    const alphaSawJoin = waitFor(alpha, 'player:joined');

    const beta = await connectClient('beta');
    const betaState = await joinRoom(beta, 'hackatec', 'Beta');
    const joined = await alphaSawJoin;

    assert(betaState.players.length === 2, 'beta should receive a two-player snapshot');
    assert(
        betaState.players.some((player) => player.name === 'Alpha') &&
        betaState.players.some((player) => player.name === 'Beta'),
        'beta snapshot is missing room players'
    );
    assert(joined.player?.name === 'Beta', 'alpha did not observe beta joining');

    const gamma = await connectClient('gamma');
    const gammaState = await joinRoom(gamma, 'other-room', 'Gamma');

    assert(gammaState.players.length === 1, 'other-room should be isolated');
    assert(gammaState.players[0]?.name === 'Gamma', 'other-room contains an unexpected player');

    const alphaSawLeave = waitFor(alpha, 'player:left');
    const betaId = beta.id;

    beta.disconnect();

    const left = await alphaSawLeave;

    assert(left.playerId === betaId, 'alpha did not observe beta leaving');

    console.log('[smoke] same-room join/state/leave verified');
    console.log('[smoke] room isolation verified');

    alpha.disconnect();
    gamma.disconnect();
}

main()
    .then(() =>
    {
        process.exit(0);
    })
    .catch((error) =>
    {
        console.error('[smoke] failed:', error);

        for (const socket of sockets)
        {
            socket.disconnect();
        }

        process.exit(1);
    });
