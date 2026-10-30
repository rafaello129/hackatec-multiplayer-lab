import { MATCH_BALANCE } from '@hackatec/shared';
import type {
    PlayerState,
    GameMapState,
    RoomErrorCode
} from '@hackatec/shared';
import {
    MAX_PLAYERS_PER_ROOM,
    PLAYER_COLORS
} from '../game/constants.js';
import { createMapSeed, generateMap } from '../game/mapGenerator.js';
import { getSpawnPosition } from '../game/spawn.js';

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_PLAYER_NAME_LENGTH = 20;

type LeaveResult = {
    roomId: string;
    player: PlayerState;
    hostId?: string;
};

export type JoinSuccess = {
    ok: true;
    roomId: string;
    player: PlayerState;
    players: PlayerState[];
    map: GameMapState;
    hostId: string;
    previous?: LeaveResult;
};

export type JoinFailure = {
    ok: false;
    code: RoomErrorCode;
    message: string;
};

export type JoinResult = JoinSuccess | JoinFailure;

export function isValidRoomId(roomId: string): boolean
{
    return ROOM_ID_PATTERN.test(roomId);
}

export function normalizePlayerName(
    playerName: string | undefined,
    socketId: string
): string
{
    const normalized = playerName
        ?.trim()
        .replace(/\s+/g, ' ')
        .slice(0, MAX_PLAYER_NAME_LENGTH);

    if (normalized)
    {
        return normalized;
    }

    return `Player-${socketId.slice(0, 4).toUpperCase()}`;
}

export class RoomManager
{
    private readonly rooms = new Map<string, Map<string, PlayerState>>();
    private readonly roomMaps = new Map<string, GameMapState>();
    private readonly socketRooms = new Map<string, string>();
    // Map insertion order is join order, so the first remaining player is host.
    private readonly roomHosts = new Map<string, string>();

    join(
        roomId: string,
        socketId: string,
        playerName?: string
    ): JoinResult
    {
        if (!isValidRoomId(roomId))
        {
            return {
                ok: false,
                code: 'INVALID_ROOM',
                message: 'La sala debe usar 1-32 caracteres: letras, números, guion o guion bajo.'
            };
        }

        const currentRoomId = this.socketRooms.get(socketId);

        if (currentRoomId === roomId)
        {
            const currentRoom = this.rooms.get(roomId);
            const existingPlayer = currentRoom?.get(socketId);

            if (currentRoom && existingPlayer)
            {
                return {
                    ok: true,
                    roomId,
                    player: existingPlayer,
                    players: [...currentRoom.values()],
                    map: this.getOrCreateMap(roomId),
                    hostId: this.roomHosts.get(roomId) ?? socketId
                };
            }
        }

        const targetRoom = this.rooms.get(roomId);

        if (
            targetRoom &&
            !targetRoom.has(socketId) &&
            targetRoom.size >= MAX_PLAYERS_PER_ROOM
        )
        {
            return {
                ok: false,
                code: 'ROOM_FULL',
                message: 'La sala alcanzó el límite de jugadores.'
            };
        }

        const previous = this.leave(socketId);
        const room = this.rooms.get(roomId) ?? new Map<string, PlayerState>();

        if (!this.rooms.has(roomId))
        {
            this.rooms.set(roomId, room);
        }

        const map = this.getOrCreateMap(roomId);
        const spawnIndex = this.findAvailableSpawnIndex(room);
        const spawn = getSpawnPosition(spawnIndex);
        const player: PlayerState = {
            id: socketId,
            name: normalizePlayerName(playerName, socketId),
            x: spawn.x,
            y: spawn.y,
            color: PLAYER_COLORS[spawnIndex % PLAYER_COLORS.length],
            hp: MATCH_BALANCE.initialHealth, maxHp: MATCH_BALANCE.initialHealth, alive: true, kills: 0, deaths: 0
        };

        room.set(socketId, player);
        this.socketRooms.set(socketId, roomId);
        if (!this.roomHosts.has(roomId)) this.roomHosts.set(roomId, socketId);

        return {
            ok: true,
            roomId,
            player,
            players: [...room.values()],
            map,
            hostId: this.roomHosts.get(roomId) ?? socketId,
            previous
        };
    }

    leave(socketId: string): LeaveResult | undefined
    {
        const roomId = this.socketRooms.get(socketId);

        if (!roomId)
        {
            return undefined;
        }

        const room = this.rooms.get(roomId);
        const player = room?.get(socketId);

        this.socketRooms.delete(socketId);

        if (!room || !player)
        {
            return undefined;
        }

        room.delete(socketId);
        if (this.roomHosts.get(roomId) === socketId) {
            const nextHostId = room.keys().next().value as string | undefined;
            if (nextHostId) this.roomHosts.set(roomId, nextHostId);
            else this.roomHosts.delete(roomId);
        }

        if (room.size === 0)
        {
            this.rooms.delete(roomId);
            this.roomMaps.delete(roomId);
            this.roomHosts.delete(roomId);
        }

        return {
            roomId,
            player,
            hostId: this.roomHosts.get(roomId)
        };
    }

    getPlayers(roomId: string): PlayerState[]
    {
        return [...(this.rooms.get(roomId)?.values() ?? [])];
    }

    getPlayer(socketId: string): PlayerState | undefined
    {
        const roomId = this.socketRooms.get(socketId);
        return roomId ? this.rooms.get(roomId)?.get(socketId) : undefined;
    }

    getMap(roomId: string): GameMapState | undefined
    {
        return this.roomMaps.get(roomId);
    }

    private getOrCreateMap(roomId: string): GameMapState
    {
        let map = this.roomMaps.get(roomId);
        if (!map) {
            map = generateMap(createMapSeed());
            this.roomMaps.set(roomId, map);
        }
        return map;
    }

    getRoomId(socketId: string): string | undefined
    {
        return this.socketRooms.get(socketId);
    }

    hasRoom(roomId: string): boolean
    {
        return this.rooms.has(roomId);
    }

    resetForMatch(roomId: string, mode: string | null = 'classic'): { map: GameMapState; players: PlayerState[] } | undefined
    {
        const room = this.rooms.get(roomId);
        if (!room) return undefined;
        const map = generateMap(createMapSeed(), room.size, mode);
        this.roomMaps.set(roomId, map);
        let index = 0;
        for (const player of room.values()) {
            const spawn = getSpawnPosition(index++, map.width, map.height);
            player.x = spawn.x;
            player.y = spawn.y;
            player.hp = MATCH_BALANCE.initialHealth;
            player.maxHp = MATCH_BALANCE.initialHealth;
            player.alive = true;
            player.spectator = false;
            player.kills = 0;
            player.deaths = 0;
            player.assists = 0;
            player.zombieKills = 0;
            player.survivedStormPhases = 0;
            player.isDashing = false;
            player.isInvulnerable = false;
            player.spawnInvulnerableUntil = 0;
            player.dashReadyAt = 0;
            player.shield = 0;
            player.selectedWeapon = 'pistol';
            player.immobilizedUntil = 0;
        }
        return { map, players: [...room.values()] };
    }

    getHostId(roomId: string): string | undefined
    {
        return this.roomHosts.get(roomId);
    }

    private findAvailableSpawnIndex(room: Map<string, PlayerState>): number
    {
        for (let index = 0; index < MAX_PLAYERS_PER_ROOM; index += 1)
        {
            const spawn = getSpawnPosition(index);
            const occupied = [...room.values()].some(
                (player) => player.x === spawn.x && player.y === spawn.y
            );

            if (!occupied)
            {
                return index;
            }
        }

        return room.size;
    }
}
