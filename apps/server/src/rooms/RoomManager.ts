import type {
    GameMapState,
    PlayerState,
    RoomErrorCode
} from '@hackatec/shared';
import {
    MAX_PLAYERS_PER_ROOM,
    PLAYER_COLORS
} from '../game/constants.js';
import {
    createMapSeed,
    generateMap
} from '../game/mapGenerator.js';
import { getSpawnPosition } from '../game/spawn.js';

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_PLAYER_NAME_LENGTH = 20;

type LeaveResult = {
    roomId: string;
    player: PlayerState;
};

export type JoinSuccess = {
    ok: true;
    roomId: string;
    player: PlayerState;
    players: PlayerState[];
    map: GameMapState;
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

    return 'Player-' + socketId.slice(0, 4).toUpperCase();
}

export class RoomManager
{
    private readonly rooms = new Map<string, Map<string, PlayerState>>();
    private readonly roomMaps = new Map<string, GameMapState>();
    private readonly socketRooms = new Map<string, string>();

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
                    map: this.getOrCreateMap(roomId)
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
            color: PLAYER_COLORS[spawnIndex % PLAYER_COLORS.length]
        };

        room.set(socketId, player);
        this.socketRooms.set(socketId, roomId);

        return {
            ok: true,
            roomId,
            player,
            players: [...room.values()],
            map,
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

        if (room.size === 0)
        {
            this.rooms.delete(roomId);
            this.roomMaps.delete(roomId);
        }

        return {
            roomId,
            player
        };
    }

    getPlayers(roomId: string): PlayerState[]
    {
        return [...(this.rooms.get(roomId)?.values() ?? [])];
    }

    getMap(roomId: string): GameMapState | undefined
    {
        return this.roomMaps.get(roomId);
    }

    getRoomId(socketId: string): string | undefined
    {
        return this.socketRooms.get(socketId);
    }

    hasRoom(roomId: string): boolean
    {
        return this.rooms.has(roomId);
    }

    private getOrCreateMap(roomId: string): GameMapState
    {
        const currentMap = this.roomMaps.get(roomId);

        if (currentMap)
        {
            return currentMap;
        }

        const map = generateMap(createMapSeed());

        this.roomMaps.set(roomId, map);

        return map;
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
