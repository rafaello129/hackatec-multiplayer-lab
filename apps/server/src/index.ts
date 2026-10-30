import 'dotenv/config';

import argon2 from 'argon2';
import { createServer } from 'node:http';
import express, { type Request, type RequestHandler, type Response } from 'express';
import { Server } from 'socket.io';
import { getAllowedOrigins, getServerConfig } from './config/env.js';
import { AccountStore, SESSION_COOKIE, SESSION_TTL_MS } from './auth/AccountStore.js';
import { uploadSkin, skinsUploadHandler } from './http/skins.js';
import { healthHandler } from './http/health.js';
import { registerSocketHandlers } from './socket/index.js';

const config = getServerConfig();
const app = express();
if (process.env.NODE_ENV === 'production' && config.corsOrigin === '*') {
    throw new Error('En producción, configura CORS_ORIGIN con los orígenes exactos del cliente.');
}

const accounts = new AccountStore();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) return undefined;
    for (const part of cookieHeader.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0) continue;
        if (part.slice(0, separator).trim() === name) {
            try { return decodeURIComponent(part.slice(separator + 1).trim()); }
            catch { return undefined; }
        }
    }
    return undefined;
}

function setSessionCookie(response: Response, token: string): void {
    const production = process.env.NODE_ENV === 'production';
    const secure = production ? '; Secure' : '';
    const sameSite = production ? 'None' : 'Lax';
    response.setHeader('Set-Cookie',
        `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
}

function clearSessionCookie(response: Response): void {
    const production = process.env.NODE_ENV === 'production';
    const secure = production ? '; Secure' : '';
    const sameSite = production ? 'None' : 'Lax';
    response.setHeader('Set-Cookie',
        `${SESSION_COOKIE}=; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=0${secure}`);
}


const requireTrustedOrigin: RequestHandler = (request, response, next) => {
    const origin = request.headers.origin;
    if (!origin) {
        if (process.env.NODE_ENV === 'production') {
            response.status(403).json({ error: 'Origen no permitido.' });
            return;
        }
        next();
        return;
    }
    const allowed = getAllowedOrigins(config.corsOrigin);
    if (allowed !== '*' && !allowed.includes(origin)) {
        response.status(403).json({ error: 'Origen no permitido.' });
        return;
    }
    next();
};

function accountResponse(account: { id: string; username: string; appearance: unknown }) {
    return { id: account.id, username: account.username, appearance: account.appearance };
}

function validateCredentials(body: unknown): { username: string; password: string } | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
    const value = body as Record<string, unknown>;
    if (typeof value.username !== 'string' || typeof value.password !== 'string') return undefined;
    const username = value.username.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(username)) return undefined;
    if (value.password.length < 8 || value.password.length > 128) return undefined;
    return { username, password: value.password };
}

app.use(express.json({ limit: '16kb' }));
app.use((request, response, next) => {
    const allowedOrigins = getAllowedOrigins(config.corsOrigin);
    const requestOrigin = request.headers.origin;
    if (requestOrigin && (allowedOrigins === '*' || allowedOrigins.includes(requestOrigin))) {
        response.setHeader('Access-Control-Allow-Origin', requestOrigin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (request.method === 'OPTIONS') {
        response.sendStatus(204);
        return;
    }
    next();
});

app.get('/health', healthHandler);

app.post('/api/auth/register', requireTrustedOrigin, async (request: Request, response: Response) => {
    const credentials = validateCredentials(request.body);
    if (!credentials) {
        response.status(400).json({ error: 'Usuario o contraseña inválidos. El usuario debe tener 3-16 caracteres y la contraseña al menos 8.' });
        return;
    }
    try {
        const passwordHash = await argon2.hash(credentials.password, { type: argon2.argon2id });
        const account = accounts.createAccount(credentials.username, passwordHash);
        const token = accounts.createSession(account.id);
        setSessionCookie(response, token);
        response.status(201).json({ account: accountResponse(account) });
    } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed: accounts.username_key')) {
            response.status(409).json({ error: 'Ese nombre de usuario no está disponible.' });
            return;
        }
        console.error('[auth] registration failed:', error instanceof Error ? error.message : 'unknown error');
        response.status(500).json({ error: 'No se pudo crear la cuenta.' });
    }
});

app.post('/api/auth/login', requireTrustedOrigin, async (request: Request, response: Response) => {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = loginAttempts.get(ip);
    if (current && current.resetAt > now && current.count >= MAX_LOGIN_ATTEMPTS) {
        response.status(429).json({ error: 'Demasiados intentos. Inténtalo más tarde.' });
        return;
    }
    const credentials = validateCredentials(request.body);
    const fail = () => {
        const entry = loginAttempts.get(ip);
        if (!entry || entry.resetAt <= now) loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
        else entry.count += 1;
        response.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    };
    if (!credentials) { fail(); return; }
    const row = accounts.findAccountByUsername(credentials.username);
    if (!row) { fail(); return; }
    try {
        const valid = await argon2.verify(row.password_hash, credentials.password);
        if (!valid) { fail(); return; }
        loginAttempts.delete(ip);
        const account = accounts.getAccountById(row.id);
        if (!account) { fail(); return; }
        const token = accounts.createSession(account.id);
        setSessionCookie(response, token);
        response.setHeader('Cache-Control', 'no-store');
        response.json({ account: accountResponse(account) });
    } catch (error) {
        console.error('[auth] login verification failed:', error instanceof Error ? error.message : 'unknown error');
        response.status(500).json({ error: 'No se pudo iniciar sesión.' });
    }
});

app.get('/api/auth/session', (request: Request, response: Response) => {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const account = accounts.getAccountBySessionToken(token);
    response.setHeader('Cache-Control', 'no-store');
    if (!account) {
        response.status(401).json({ error: 'Sesión no válida.' });
        return;
    }
    response.json({ account: accountResponse(account) });
});

app.post('/api/auth/logout', requireTrustedOrigin, (request: Request, response: Response) => {
    accounts.revokeSession(readCookie(request.headers.cookie, SESSION_COOKIE));
    clearSessionCookie(response);
    response.status(204).end();
});

app.use('/skins', express.static('storage/skins'));
const requireAuthenticatedUpload: RequestHandler = (request, response, next) => {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (!accounts.getAccountBySessionToken(token)) {
        response.status(401).json({ error: 'Inicia sesión para subir una skin.' });
        return;
    }
    next();
};
app.post('/api/skins', requireTrustedOrigin, requireAuthenticatedUpload, uploadSkin, skinsUploadHandler);

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: config.corsOrigin === '*' ? true : getAllowedOrigins(config.corsOrigin),
        methods: ['GET', 'POST'],
        credentials: true
    }
});

registerSocketHandlers(io, undefined, accounts, config.corsOrigin);

httpServer.listen(config.port, config.host, () => {
    console.log(`[server] HackaTec Multiplayer Server listening on http://${config.host}:${config.port}`);
    console.log(`[server] Health check: http://localhost:${config.port}/health`);
});
