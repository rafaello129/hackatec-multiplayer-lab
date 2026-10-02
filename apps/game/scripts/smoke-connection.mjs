import { io } from 'socket.io-client';

const url = process.env.VITE_SERVER_URL || 'http://127.0.0.1:3001';

const socket = io(url, {
    autoConnect: true,
    transports: ['websocket', 'polling'],
    timeout: 5000
});

const fail = (message) =>
{
    console.error(`[smoke] ${message}`);
    socket.disconnect();
    process.exit(1);
};

const timer = setTimeout(() =>
{
    fail('timed out waiting for Socket.IO connection');
}, 7000);

socket.on('connect', () =>
{
    console.log(`[smoke] connected: ${socket.id}`);
});

socket.on('connection:ready', (payload) =>
{
    clearTimeout(timer);

    if (!payload || payload.message !== 'connected' || !payload.socketId)
    {
        fail('invalid connection:ready payload');
        return;
    }

    console.log(`[smoke] server ready: ${payload.socketId}`);
    socket.disconnect();
    process.exit(0);
});

socket.on('connect_error', (error) =>
{
    clearTimeout(timer);
    fail(`connection error: ${error.message}`);
});
