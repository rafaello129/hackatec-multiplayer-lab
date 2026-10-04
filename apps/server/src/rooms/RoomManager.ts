import type {
    PlayerState,
    RoomErrorCode
} from '@hackatec/shared';
import {
    MAX_PLAYERS_PER_ROOM,
    PLAYER_COLORS
} from '../game/constants.js';
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
                    players: [...currentRoom.values()]
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

        const spawnIndex = this.findAvailableSpawnIndex(room);
        const spawn = getSpawnPosition(spawnIndex);
        const player: PlayerState = {
            id: socketId,
            name: normalizePlayerName(playerName, socketId),
            x: spawn.x,
            y: spawn.y,
            color: PLAYER_COLORS[spawnIndex % PLAYER_COLORS.length],
            appearance: {
                mode: 'color',
                colorHex: '#FFFFFF'
            }
        };

        room.set(socketId, player);
        this.socketRooms.set(socketId, roomId);

        return {
            ok: true,
            roomId,
            player,
            players: [...room.values()],
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

    getRoomId(socketId: string): string | undefined
    {
        return this.socketRooms.get(socketId);
    }

    hasRoom(roomId: string): boolean
    {
        return this.rooms.has(roomId);
    }

    setPlayerName(
        socketId: string,
        name: string
    ): boolean
    {
        const roomId = this.socketRooms.get(socketId);
        const room = roomId
            ? this.rooms.get(roomId)
            : undefined;

        const player = room?.get(socketId);

        if (!player)
        {
            return false;
        }

        player.name = name;

        return true;
    }

    setPlayerAppearance(
        socketId: string,
        appearance: PlayerState['appearance']
    ): boolean
    {
        const roomId = this.socketRooms.get(socketId);
        const room = roomId
            ? this.rooms.get(roomId)
            : undefined;

        const player = room?.get(socketId);

        if (!player)
        {
            return false;
        }

        player.appearance = appearance;

        return true;
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
