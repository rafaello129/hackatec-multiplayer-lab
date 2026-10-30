import {
    SOCKET_EVENTS,
    MATCH_BALANCE,
    type ConnectionReadyPayload,
    type PlayerInput,
    type PlayerState,
    type PlayerInputPayload,
    type ProfileUpdatePayload,
    type PlayerJoinedPayload,
    type PlayerLeftPayload,
    type RoomErrorPayload,
    type RoomStatePayload,
    type GameMode,
    type MatchVotePayload,
    type HostStartMatchPayload,
    type ChatSendPayload,
    type ChatChannel,
    CHAT_TEXTS,
    PROFILE_TEXTS
} from '@hackatec/shared';
import type { Server } from 'socket.io';
import { createMovementRuntime, acceptMovementInput, advanceMovement, type MovementRuntime } from '../game/movement.js';
import { CombatManager } from '../game/CombatManager.js';
import { PickupManager } from '../pickups/PickupManager.js';
import { StormManager } from '../storm/StormManager.js';
import { isZombieMode, ZombieManager } from '../zombies/ZombieManager.js';
import { ChatManager } from '../chat/ChatManager.js';
import { calculateMatchAwards, RoundActivityTracker } from '../progression/ProgressionManager.js';
import { AccountStore, normalizeUsername, SESSION_COOKIE, type Account } from '../auth/AccountStore.js';
import { getAllowedOrigins } from '../config/env.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { MatchManager } from '../rooms/MatchManager.js';
import { parseJoinPayload } from './validateJoinPayload.js';

function socketRoom(roomId: string): string
{
    return `room:${roomId}`;
}

function publicPlayerState(player: PlayerState): PlayerState {
    if (player.selectedWeapon !== 'laser') return player;
    return { ...player, selectedWeapon: 'pistol' };
}

function isSkinAssetRecord(value: unknown): value is {
    id: string;
    url: string;
    width: number;
    height: number;
} {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const asset = value as Record<string, unknown>;
    return typeof asset.id === 'string' &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp)$/i.test(asset.id) &&
        asset.url === '/skins/' + asset.id &&
        Number.isInteger(asset.width) && (asset.width as number) >= 1 && (asset.width as number) <= 512 &&
        Number.isInteger(asset.height) && (asset.height as number) >= 1 && (asset.height as number) <= 512;
}

export function registerSocketHandlers(
    io: Server,
    roomManager = new RoomManager(),
    accounts = new AccountStore(),
    corsOrigin = '*'
)
{
    const movement = new Map<string, MovementRuntime>();
    const combat = new CombatManager();
    const pickupManager = new PickupManager();
    const stormManager = new StormManager();
    const zombieManager = new ZombieManager();
    const chatManager = new ChatManager();
    const activityTracker = new RoundActivityTracker();
    const matches = new MatchManager();
    const identities = new Map<string, string>();
    const laserPermissions = new Map<string, boolean>();
    const lastWeaponStateSyncAt = new Map<string, number>();
    const lastStormStateSyncAt = new Map<string, number>();
    const lastZombieStateSyncAt = new Map<string, number>();
    const lastMovementPacketAt = new Map<string, number>();
    const MOVEMENT_PACKET_MIN_INTERVAL_MS = 20;

    const syncMatchRoom = (roomId: string, now: number): void => {
        const players = roomManager.getPlayers(roomId);
        const accountIds = new Map<string, string>();
        for (const player of players) accountIds.set(player.id, identities.get(player.id) ?? player.id);
        matches.syncRoom(roomId, players, roomManager.getHostId(roomId), now, accountIds);
    };

    const resetRoomForMatch = (roomId: string): void => {
        const reset = roomManager.resetForMatch(roomId);
        if (!reset) return;
        const mode = matches.getState(roomId)?.mode ?? null;

        if (mode === 'everyone-vs-one') {
            const titanIndex = Math.floor(Math.random() * reset.players.length);
            const hunterCount = Math.max(1, reset.players.length - 1);
            for (const [index, player] of reset.players.entries()) {
                if (index === titanIndex) {
                    player.role = 'titan';
                    player.lives = undefined;
                    player.maxHp = MATCH_BALANCE.titanBaseHealth +
                        hunterCount * MATCH_BALANCE.titanHealthPerHunter;
                    player.hp = player.maxHp;
                } else {
                    player.role = 'hunter';
                    player.lives = MATCH_BALANCE.hunterLives;
                    player.maxHp = MATCH_BALANCE.initialHealth;
                    player.hp = MATCH_BALANCE.initialHealth;
                }
            }
        } else if (mode === 'battleRoyale') {
            for (const player of reset.players) {
                player.role = 'survivor';
                player.lives = 1;
                player.maxHp = MATCH_BALANCE.initialHealth;
                player.hp = MATCH_BALANCE.initialHealth;
            }
        } else {
            for (const player of reset.players) {
                player.role = undefined;
                player.lives = undefined;
                player.maxHp = MATCH_BALANCE.initialHealth;
                player.hp = MATCH_BALANCE.initialHealth;
            }
        }

        combat.resetRoom(roomId);
        io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.ROOM_MAP, reset.map);
        const pickupState = pickupManager.reset(roomId, reset.map);
        io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PICKUP_STATE, { roomId, pickups: pickupState });
        if (mode === 'battleRoyale') {
            const stormState = stormManager.start(roomId, reset.map, Date.now());
            io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.STORM_STATE, stormState);
        } else {
            stormManager.removeRoom(roomId);
        }
        if (isZombieMode(mode)) {
            const zombieState = zombieManager.reset(roomId, reset.map, reset.players, Date.now());
            io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.ZOMBIE_STATE, zombieState);
        } else {
            zombieManager.removeRoom(roomId);
            io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.ZOMBIE_STATE, {
                roomId, zombies: [], projectiles: [], puddles: []
            });
        }
        io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.COMBAT_STATE, { players: reset.players.map(publicPlayerState), projectiles: [], beams: [], explosions: [], trapped: [], heals: [], zombieHits: [] });
        for (const player of reset.players) {
            const weaponState = combat.initializePlayer(
                roomId,
                player,
                laserPermissions.get(player.id) === true,
                mode
            );
            io.to(player.id).emit(SOCKET_EVENTS.WEAPON_STATE, weaponState);
        }
        for (const [socketId] of movement) {
            if (roomManager.getRoomId(socketId) === roomId) movement.set(socketId, createMovementRuntime());
        }
    };

    io.use((socket, next) => {
        const origin = socket.handshake.headers.origin;
        const allowedOrigins = getAllowedOrigins(corsOrigin);
        if (process.env.NODE_ENV === 'production' && (!origin || allowedOrigins === '*')) {
            next(new Error('ORIGIN_NOT_ALLOWED'));
            return;
        }
        if (origin && allowedOrigins !== '*' && !allowedOrigins.includes(origin)) {
            next(new Error('ORIGIN_NOT_ALLOWED'));
            return;
        }
        const cookieHeader = socket.handshake.headers.cookie;
        const token = cookieHeader?.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
        let decodedToken: string | undefined;
        try { decodedToken = token ? decodeURIComponent(token) : undefined; } catch { decodedToken = undefined; }
        const account = accounts.getAccountBySessionToken(decodedToken);
        if (!account) {
            next(new Error('UNAUTHORIZED'));
            return;
        }
        socket.data.account = account;
        socket.data.sessionToken = decodedToken;
        next();
    });
    const rooms = new Set<string>();
    const tick = setInterval(() => {
        const now = Date.now();

        for (const [socketId, state] of movement) {
            const player = roomManager.getPlayer(socketId);
            const roomId = roomManager.getRoomId(socketId);
            if (!player || !roomId) { movement.delete(socketId); continue; }
            rooms.add(roomId);
            if (player.spectator || !matches.isPlaying(roomId)) continue;
            const map = roomManager.getMap(roomId);
            if (!map) continue;
            const wasDashing = player.isDashing;
            const wasInvulnerable = player.isInvulnerable;
            const moved = advanceMovement(player, state, map, 50, now);
            if (moved || wasDashing !== player.isDashing || wasInvulnerable !== player.isInvulnerable) {
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player: publicPlayerState(player) });
            }
        }

        for (const roomId of rooms) {
            if (!roomManager.hasRoom(roomId)) {
                rooms.delete(roomId);
                continue;
            }
            syncMatchRoom(roomId, now);
        }

        for (const roomId of rooms) activityTracker.tick(roomId, now);
        for (const transition of matches.advance(now, id => roomManager.getPlayers(id))) {
            if (transition.resetPlayers) resetRoomForMatch(transition.roomId);
            if (transition.previousPhase === 'countdown' && transition.phase === 'playing') {
                const match = matches.getState(transition.roomId);
                const duration = match?.endsAt ? Math.max(1, match.endsAt - now) : MATCH_BALANCE.classicDurationMs;
                activityTracker.start(transition.roomId, roomManager.getPlayers(transition.roomId), now, duration);
            }
            if (transition.previousPhase === 'playing' && transition.phase === 'results') {
                const match = matches.getState(transition.roomId);
                if (match?.mode) {
                    const players = roomManager.getPlayers(transition.roomId);
                    const awards = calculateMatchAwards(players, match.results, match.mode, match.winnerId ?? null);
                    for (const award of awards) {
                        if (award.xp <= 0 || !activityTracker.isEligible(transition.roomId, award.playerId)) continue;
                        const accountId = identities.get(award.playerId);
                        if (!accountId) continue;
                        try {
                            const progression = accounts.addXP(accountId, award.xp);
                            if (progression) io.to(award.playerId).emit(SOCKET_EVENTS.PROGRESSION_STATE, {
                                ...progression,
                                awardedXP: award.xp
                            });
                        } catch (error) {
                            console.error('[progression] award failed:', error instanceof Error ? error.message : 'unknown error');
                        }
                    }
                }
                activityTracker.removeRoom(transition.roomId);
            }
            if (transition.phase === 'waiting' && transition.previousPhase === 'results') {
                activityTracker.removeRoom(transition.roomId);
            }
        }

        for (const roomId of rooms) {
            const map = roomManager.getMap(roomId);
            if (!map) { rooms.delete(roomId); continue; }
            if (!matches.isPlaying(roomId)) continue;
            const players = roomManager.getPlayers(roomId);
            const mode = matches.getState(roomId)?.mode ?? null;
            const pickupStep = pickupManager.step(roomId, players, mode, now);
            if (pickupStep.changed) {
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PICKUP_STATE, { roomId, pickups: pickupStep.pickups });
                for (const collected of pickupStep.collected) io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PICKUP_COLLECTED, collected);
            }
            const zombieEnabled = isZombieMode(mode);
            const activeZombies = zombieEnabled ? zombieManager.getTargets(roomId) : [];
            const snapshot = combat.step(roomId, players, map, 50, now, mode ?? 'classic', activeZombies);
            const zombieHitsApplied = zombieEnabled && zombieManager.applyHits(roomId, snapshot.zombieHits, players);
            let zombieSnapshotChanged = Boolean(zombieHitsApplied);
            if (zombieEnabled) {
                const zombieStep = zombieManager.step(roomId, players, map, 50, now);
                if (zombieStep) {
                    for (const item of zombieStep.damage) {
                        const player = players.find(candidate => candidate.id === item.playerId);
                        if (player) combat.applyEnvironmentalDamage(roomId, player, item.amount, now);
                    }
                    if (now - (lastZombieStateSyncAt.get(roomId) ?? 0) >= 100 || zombieSnapshotChanged) {
                        lastZombieStateSyncAt.set(roomId, now);
                        io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.ZOMBIE_STATE, zombieStep.state);
                    }
                }
            }
            if (mode === 'battleRoyale') {
                const stormStep = stormManager.step(roomId, players, map, 50, now);
                if (stormStep) {
                    for (const item of stormStep.damage) {
                        const player = players.find(candidate => candidate.id === item.playerId);
                        if (player) combat.applyEnvironmentalDamage(roomId, player, item.amount, now);
                    }
                    if (now - (lastStormStateSyncAt.get(roomId) ?? 0) >= 100) {
                        lastStormStateSyncAt.set(roomId, now);
                        io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.STORM_STATE, stormStep.state);
                    }
                }
            }
            io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.COMBAT_STATE, {
                players: players.map(publicPlayerState),
                projectiles: snapshot.projectiles,
                beams: snapshot.beams,
                explosions: snapshot.explosions,
                trapped: snapshot.trapped,
                heals: snapshot.heals,
                killFeed: snapshot.killFeed
            });
            for (const trapped of snapshot.trapped) io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_TRAPPED, trapped);
            for (const healed of snapshot.heals) io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_HEALED, healed);
            if (now - (lastWeaponStateSyncAt.get(roomId) ?? 0) >= 100) {
                lastWeaponStateSyncAt.set(roomId, now);
                for (const player of players) {
                    io.to(player.id).emit(SOCKET_EVENTS.WEAPON_STATE, combat.getWeaponState(roomId, player.id, now, mode));
                }
            }
        }

        for (const state of matches.takeUpdates()) {
            io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
        }
    }, 50);
    tick.unref?.();

    io.on('connection', (socket) =>
    {
        socket.use((_packet, next) => {
            const sessionToken = socket.data.sessionToken as string | undefined;
            if (!accounts.getAccountBySessionToken(sessionToken)) {
                socket.disconnect(true);
                next(new Error('UNAUTHORIZED'));
                return;
            }
            next();
        });

        console.log(`[socket] connected: ${socket.id}`);

        const payload: ConnectionReadyPayload = {
            message: 'connected',
            socketId: socket.id
        };

        socket.emit(SOCKET_EVENTS.CONNECTION_READY, payload);

        socket.on(SOCKET_EVENTS.ROOM_JOIN, async (rawPayload: unknown) =>
        {
            const parsed = parseJoinPayload(rawPayload);

            if (!parsed.ok)
            {
                const errorPayload: RoomErrorPayload = {
                    code: 'INVALID_ROOM',
                    message: parsed.message
                };
                socket.emit(SOCKET_EVENTS.ROOM_ERROR, errorPayload);
                return;
            }

            const account = socket.data.account as Account | undefined;
            if (!account) {
                socket.emit(SOCKET_EVENTS.ROOM_ERROR, { code: 'AUTH_REQUIRED', message: 'Inicia sesión para entrar a una sala.' });
                return;
            }
            const roomId = parsed.value.roomId.trim();
            const previousRoomId = roomManager.getRoomId(socket.id);
            const profile = accounts.getAccountById(account.id);
            if (!profile) {
                socket.emit(SOCKET_EVENTS.ROOM_ERROR, { code: 'AUTH_REQUIRED', message: 'La sesión ya no es válida.' });
                return;
            }
            const duplicateAccountPlayer = roomManager.getPlayers(roomId).find(
                member => member.id !== socket.id && identities.get(member.id) === account.id
            );
            if (duplicateAccountPlayer) {
                socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
                    code: 'ACCOUNT_IN_ROOM',
                    message: 'Esta cuenta ya está participando en esa sala.'
                });
                return;
            }
            const result = roomManager.join(roomId, socket.id, profile.username);

            if (!result.ok)
            {
                const errorPayload: RoomErrorPayload = {
                    code: result.code,
                    message: result.message
                };

                socket.emit(SOCKET_EVENTS.ROOM_ERROR, errorPayload);
                return;
            }

            if (!socket.connected) return;
            identities.set(socket.id, account.id);
            const canUseLaser = normalizeUsername(profile.username) === 'gueta';
            laserPermissions.set(socket.id, canUseLaser);
            const initialWeaponState = combat.initializePlayer(result.roomId, result.player, canUseLaser, matches.getState(result.roomId)?.mode ?? null);
            result.player.appearance = profile.appearance;
            if (result.previous)
            {
                socket.leave(socketRoom(result.previous.roomId));

                const leftPayload: PlayerLeftPayload = {
                    playerId: result.previous.player.id
                };

                io.to(socketRoom(result.previous.roomId))
                    .emit(SOCKET_EVENTS.PLAYER_LEFT, leftPayload);

                syncMatchRoom(result.previous.roomId, Date.now());
                for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
                if (result.previous.hostId) io.to(socketRoom(result.previous.roomId)).emit(SOCKET_EVENTS.ROOM_HOST_CHANGED, { hostId: result.previous.hostId });
                console.log(
                    `[room] ${socket.id} left ${result.previous.roomId}`
                );
            }

            if (previousRoomId && previousRoomId !== result.roomId) {
                combat.leave(previousRoomId, socket.id, !roomManager.hasRoom(previousRoomId));
                if (!roomManager.hasRoom(previousRoomId)) {
                    rooms.delete(previousRoomId);
                    pickupManager.removeRoom(previousRoomId);
                    stormManager.removeRoom(previousRoomId);
                    zombieManager.removeRoom(previousRoomId);
                    lastWeaponStateSyncAt.delete(previousRoomId);
                    lastStormStateSyncAt.delete(previousRoomId);
                    lastZombieStateSyncAt.delete(previousRoomId);
                    chatManager.removeRoom(previousRoomId);
                    activityTracker.removeRoom(previousRoomId);
                }
            }
            if (!movement.has(socket.id) || previousRoomId !== result.roomId) movement.set(socket.id, createMovementRuntime());
            rooms.add(result.roomId);
            socket.join(socketRoom(result.roomId));

            syncMatchRoom(result.roomId, Date.now());

            const statePayload: RoomStatePayload = {
                roomId: result.roomId,
                selfId: socket.id,
                players: result.players.map(publicPlayerState),
                map: result.map,
                hostId: result.hostId
            };

            socket.emit(SOCKET_EVENTS.ROOM_STATE, statePayload);
            socket.emit(SOCKET_EVENTS.MATCH_STATE, matches.getState(result.roomId));
            socket.emit(SOCKET_EVENTS.WEAPON_STATE, initialWeaponState);
            socket.emit(SOCKET_EVENTS.PICKUP_STATE, { roomId: result.roomId, pickups: pickupManager.getState(result.roomId) });
            const stormState = stormManager.getState(result.roomId, Date.now());
            if (stormState) socket.emit(SOCKET_EVENTS.STORM_STATE, stormState);
            socket.emit(SOCKET_EVENTS.ZOMBIE_STATE, zombieManager.getState(result.roomId));
            const progression = accounts.getProgression(account.id);
            if (progression) socket.emit(SOCKET_EVENTS.PROGRESSION_STATE, progression);
            socket.emit(SOCKET_EVENTS.CHAT_HISTORY, chatManager.getHistory(result.roomId, result.player.spectator === true));
            for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);

            if (previousRoomId !== result.roomId)
            {
                const joinedPayload: PlayerJoinedPayload = {
                    player: publicPlayerState(result.player)
                };

                socket.to(socketRoom(result.roomId))
                    .emit(SOCKET_EVENTS.PLAYER_JOINED, joinedPayload);

                console.log(
                    `[room] ${socket.id} joined ${result.roomId} as ${result.player.name}`
                );
            }
        });

        socket.on(SOCKET_EVENTS.CHAT_SEND, (raw: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            const player = roomManager.getPlayer(socket.id);
            const accountId = identities.get(socket.id);
            if (!roomId || !player || !accountId || !raw || typeof raw !== 'object' || Array.isArray(raw)) return;
            const payload = raw as Partial<ChatSendPayload>;
            if (payload.channel !== 'all' && payload.channel !== 'spectators') {
                socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, { error: CHAT_TEXTS.errors.invalidChannel });
                return;
            }
            const channel: ChatChannel = payload.channel;
            const result = chatManager.send(roomId, player, accountId, channel, payload.text, Date.now());
            if (!result.ok || !result.message) {
                socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, { error: result.error });
                return;
            }
            if (channel === 'all') {
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.CHAT_MESSAGE, result.message);
            } else {
                for (const spectator of roomManager.getPlayers(roomId).filter(candidate => candidate.spectator)) {
                    io.to(spectator.id).emit(SOCKET_EVENTS.CHAT_MESSAGE, result.message);
                }
            }
        });

        socket.on(SOCKET_EVENTS.PROFILE_SET, async (raw: unknown) => {
            const player = roomManager.getPlayer(socket.id);
            const roomId = roomManager.getRoomId(socket.id);
            const userId = identities.get(socket.id);
            if (!player || !roomId || !userId || !raw || typeof raw !== 'object') return;
            const value = raw as ProfileUpdatePayload;
            const username = value.username;
            const appearance = value.appearance;
            const skinCandidate = appearance && typeof appearance === 'object' && !Array.isArray(appearance)
                ? (appearance as { skin?: unknown }).skin
                : undefined;
            const currentAccount = accounts.getAccountById(userId);
            if (currentAccount?.isOwner && username !== undefined &&
                (typeof username !== 'string' || normalizeUsername(username.trim()) !== 'gueta')) {
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: false, message: PROFILE_TEXTS.errors.reservedOwnerName });
                return;
            }
            if (username !== undefined && (typeof username !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(username.trim()))) {
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: false, message: PROFILE_TEXTS.errors.invalidUsername });
                return;
            }
            if (appearance !== undefined && (
                !appearance || typeof appearance !== 'object' ||
                (appearance.mode !== 'color' && appearance.mode !== 'skin') ||
                typeof appearance.colorHex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(appearance.colorHex) ||
                (appearance.mode === 'skin' && (
                    !isSkinAssetRecord(skinCandidate) ||
                    !accounts.ownsSkin(userId, skinCandidate)
                ))
            )) {
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: false, message: PROFILE_TEXTS.errors.invalidAppearance });
                return;
            }
            try {
                const account = accounts.updateProfile(userId, {
                    ...(typeof username === 'string' ? { username: username.trim() } : {}),
                    ...(appearance ? { appearance } : {})
                });
                if (!account || !socket.connected || roomManager.getPlayer(socket.id) !== player || identities.get(socket.id) !== userId) return;
                player.name = account.username;
                player.appearance = account.appearance;
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player });
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: true, message: PROFILE_TEXTS.saved });
            } catch (error) {
                const message = error instanceof Error && error.message.includes('UNIQUE constraint failed: accounts.username_key')
                    ? PROFILE_TEXTS.errors.usernameTaken
                    : PROFILE_TEXTS.errors.saveFailed;
                socket.emit(SOCKET_EVENTS.PROFILE_RESULT, { ok: false, message });
            }
        });

        socket.on(SOCKET_EVENTS.MATCH_VOTE, (raw: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            if (!roomId || !raw || typeof raw !== 'object') return;
            const mode = (raw as Partial<MatchVotePayload>).mode;
            if (typeof mode !== 'string' || mode.length > 32) return;
            const accountId = identities.get(socket.id);
            if (!accountId) return;
            const result = matches.vote(roomId, socket.id, accountId, mode as GameMode, Date.now());
            socket.emit(SOCKET_EVENTS.MATCH_ACTION_RESULT, result);
            for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
        });

        socket.on(SOCKET_EVENTS.MATCH_HOST_START, (raw: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            if (!roomId || !raw || typeof raw !== 'object') return;
            const mode = (raw as Partial<HostStartMatchPayload>).mode;
            if (typeof mode !== 'string' || mode.length > 32) return;
            const result = matches.forceStart(roomId, socket.id, mode as GameMode, Date.now());
            if (result.ok) resetRoomForMatch(roomId);
            socket.emit(SOCKET_EVENTS.MATCH_ACTION_RESULT, result);
            for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
        });

        socket.on(SOCKET_EVENTS.MATCH_HOST_STOP, () => {
            const roomId = roomManager.getRoomId(socket.id);
            if (!roomId) return;
            const result = matches.stop(roomId, socket.id);
            if (result.ok) {
                combat.resetRoom(roomId);
                pickupManager.removeRoom(roomId);
                stormManager.removeRoom(roomId);
                zombieManager.removeRoom(roomId);
                activityTracker.removeRoom(roomId);

                const players = roomManager.getPlayers(roomId);
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.COMBAT_STATE, {
                    players: players.map(publicPlayerState),
                    projectiles: [],
                    beams: [],
                    explosions: [],
                    trapped: [],
                    heals: [],
                    zombieHits: [],
                    killFeed: []
                });
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.PICKUP_STATE, { roomId, pickups: [] });
                io.to(socketRoom(roomId)).emit(SOCKET_EVENTS.ZOMBIE_STATE, {
                    roomId,
                    zombies: [],
                    projectiles: [],
                    puddles: []
                });
                for (const player of players) {
                    const weaponState = combat.initializePlayer(roomId, player, laserPermissions.get(player.id) === true, null);
                    io.to(player.id).emit(SOCKET_EVENTS.WEAPON_STATE, weaponState);
                }
            }
            socket.emit(SOCKET_EVENTS.MATCH_ACTION_RESULT, result);
            for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
        });

        socket.on(SOCKET_EVENTS.PLAYER_INPUT, (raw: unknown) => {
            const now = Date.now();
            const previousPacketAt = lastMovementPacketAt.get(socket.id) ?? Number.NEGATIVE_INFINITY;
            if (now - previousPacketAt < MOVEMENT_PACKET_MIN_INTERVAL_MS) return;
            lastMovementPacketAt.set(socket.id, now);
            const activeRoom = roomManager.getRoomId(socket.id);
            const activePlayer = roomManager.getPlayer(socket.id);
            if (!activeRoom || !matches.isPlaying(activeRoom) || activePlayer?.spectator) return;
            if (!raw || typeof raw !== 'object') return;
            const input = (raw as Partial<PlayerInputPayload>).input;
            if (!input || typeof input !== 'object') return;
            const keys: (keyof PlayerInput)[] = ['up', 'down', 'left', 'right', 'dash'];
            if (!keys.every(key => typeof input[key] === 'boolean')) return;
            if (input.aimAngle !== undefined && (typeof input.aimAngle !== 'number' ||
                !Number.isFinite(input.aimAngle) || Math.abs(input.aimAngle) > Math.PI)) return;
            const state = movement.get(socket.id);
            const previousDashReadyAt = activePlayer?.dashReadyAt;
            if (state) acceptMovementInput(state, input, now, activePlayer);
            if (input.up || input.down || input.left || input.right || input.dash) {
                activityTracker.mark(activeRoom, socket.id, now);
            }
            if (activePlayer && activePlayer.dashReadyAt !== previousDashReadyAt) {
                io.to(socketRoom(activeRoom)).emit(SOCKET_EVENTS.PLAYER_MOVED, { player: publicPlayerState(activePlayer) });
            }
        });

        socket.on(SOCKET_EVENTS.WEAPON_SELECT, (raw: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            const player = roomManager.getPlayer(socket.id);
            if (!roomId || !player || player.spectator || !matches.isPlaying(roomId) ||
                !raw || typeof raw !== 'object' || Array.isArray(raw)) return;
            const slot = (raw as { slot?: unknown }).slot;
            if (typeof slot !== 'number') return;
            const result = combat.selectWeapon(roomId, player, slot, matches.getState(roomId)?.mode ?? null, Date.now());
            socket.emit(SOCKET_EVENTS.WEAPON_RESULT, result);
            socket.emit(SOCKET_EVENTS.WEAPON_STATE, combat.getWeaponState(roomId, socket.id, Date.now(), matches.getState(roomId)?.mode ?? null));
        });

        socket.on(SOCKET_EVENTS.WEAPON_FIRE, (payload: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            const player = roomManager.getPlayer(socket.id);
            if (roomId && player && !player.spectator && player.alive !== false && matches.isPlaying(roomId)) {
                const now = Date.now();
                combat.setFireIntent(roomId, player, payload, now);
                if (payload && typeof payload === 'object' && (payload as { firing?: unknown }).firing === true) {
                    activityTracker.mark(roomId, socket.id, now);
                }
            }
        });

        // Compatibility for clients that still send player:shoot; the server still chooses the active slot.
        socket.on(SOCKET_EVENTS.PLAYER_SHOOT, (payload: unknown) => {
            const roomId = roomManager.getRoomId(socket.id);
            const player = roomManager.getPlayer(socket.id);
            if (!roomId || !player || player.spectator || player.alive === false || !matches.isPlaying(roomId) ||
                !payload || typeof payload !== 'object') return;
            const angle = (payload as { angle?: unknown }).angle;
            if (typeof angle === 'number') combat.setFireIntent(roomId, player, { angle, firing: true }, Date.now());
        });

        socket.on('disconnect', (reason) => {
            movement.delete(socket.id);
            lastMovementPacketAt.delete(socket.id);
            identities.delete(socket.id);
            laserPermissions.delete(socket.id);
            const left = roomManager.leave(socket.id);

            if (left)
            {
                combat.leave(left.roomId, socket.id, !roomManager.hasRoom(left.roomId));
                if (!roomManager.hasRoom(left.roomId)) {
                    rooms.delete(left.roomId);
                    pickupManager.removeRoom(left.roomId);
                    stormManager.removeRoom(left.roomId);
                    zombieManager.removeRoom(left.roomId);
                    lastWeaponStateSyncAt.delete(left.roomId);
                    lastStormStateSyncAt.delete(left.roomId);
                    lastZombieStateSyncAt.delete(left.roomId);
                    chatManager.removeRoom(left.roomId);
                    activityTracker.removeRoom(left.roomId);
                }
                syncMatchRoom(left.roomId, Date.now());
                for (const state of matches.takeUpdates()) io.to(socketRoom(state.roomId)).emit(SOCKET_EVENTS.MATCH_STATE, state);
                if (left.hostId) io.to(socketRoom(left.roomId)).emit(SOCKET_EVENTS.ROOM_HOST_CHANGED, { hostId: left.hostId });
                const leftPayload: PlayerLeftPayload = {
                    playerId: left.player.id
                };

                io.to(socketRoom(left.roomId))
                    .emit(SOCKET_EVENTS.PLAYER_LEFT, leftPayload);

                console.log(
                    `[room] ${socket.id} left ${left.roomId}`
                );
            }

            console.log(`[socket] disconnected: ${socket.id} (${reason})`);
        });
    });

    return roomManager;
}
