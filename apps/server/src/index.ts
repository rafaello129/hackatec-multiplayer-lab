import 'dotenv/config';

import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { getAllowedOrigins, getServerConfig } from './config/env.js';
import { healthHandler } from './http/health.js';
import {
    skinsUploadHandler,
    uploadSkin
} from './http/skins.js';
import { registerSocketHandlers } from './socket/index.js';

const config = getServerConfig();
const app = express();

app.use((request, response, next) =>
{
    const allowedOrigins = getAllowedOrigins(config.corsOrigin);
    const requestOrigin = request.headers.origin;

    if (allowedOrigins === '*')
    {
        response.setHeader(
            'Access-Control-Allow-Origin',
            '*'
        );
    }
    else if (
        requestOrigin &&
        allowedOrigins.includes(requestOrigin)
    )
    {
        response.setHeader(
            'Access-Control-Allow-Origin',
            requestOrigin
        );

        response.setHeader(
            'Vary',
            'Origin'
        );
    }

    response.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'
    );

    response.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,OPTIONS'
    );

    if (request.method === 'OPTIONS')
    {
        response.sendStatus(204);
        return;
    }

    next();
});

app.get('/health', healthHandler);

app.use(
    '/skins',
    express.static('storage/skins')
);

app.post(
    '/api/skins',
    uploadSkin,
    skinsUploadHandler
);

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: getAllowedOrigins(config.corsOrigin),
        methods: ['GET', 'POST']
    }
});

registerSocketHandlers(io);

httpServer.listen(
    config.port,
    config.host,
    () =>
    {
        console.log(
            `[server] HackaTec Multiplayer Server listening on http://${config.host}:${config.port}`
        );

        console.log(
            `[server] Health check: http://localhost:${config.port}/health`
        );
    }
);