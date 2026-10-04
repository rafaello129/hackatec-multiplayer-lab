import {
    SOCKET_EVENTS,
    type ConnectionReadyPayload,
    type JoinRoomPayload,
    type PlayerAppearanceChangedPayload,
    type PlayerJoinedPayload,
    type PlayerLeftPayload,
    type PlayerUsernameChangedPayload,
    type RoomErrorPayload,
    type RoomStatePayload,
    type SetAppearancePayload,
    type SetUsernamePayload
} from '@hackatec/shared';
import type { Server } from 'socket.io';
import { RoomManager } from '../rooms/RoomManager.js';
import { ProfileService } from '../profiles/ProfileService.js';

function socketRoom(roomId: string): string
{
    return `room:${roomId}`;
}

export function registerSocketHandlers(
    io: Server,
    roomManager = new RoomManager(),
    profileService = new ProfileService()
)
{
    io.on('connection', (socket) =>
    {
        console.log(`[socket] connected: ${socket.id}`);

        const payload: ConnectionReadyPayload = {
            message: 'connected',
            socketId: socket.id
        };

        socket.emit(
            SOCKET_EVENTS.CONNECTION_READY,
            payload
        );

        socket.on(
            SOCKET_EVENTS.ROOM_JOIN,
            async (rawPayload: JoinRoomPayload) =>
            {
                const roomId =
                    typeof rawPayload?.roomId === 'string'
                        ? rawPayload.roomId.trim()
                        : '';

                const playerName =
                    typeof rawPayload?.playerName === 'string'
                        ? rawPayload.playerName
                        : undefined;

                const profileId =
                    typeof rawPayload?.profileId === 'string'
                        ? rawPayload.profileId.trim()
                        : '';

                if (!profileId)
                {
                    return;
                }

                socket.data.profileId = profileId;

                const profile =
                    await profileService.getProfile(
                        profileId
                    );

                const previousRoomId =
                    roomManager.getRoomId(
                        socket.id
                    );

                const result =
                    roomManager.join(
                        roomId,
                        socket.id,
                        playerName
                    );

                if (!result.ok)
                {
                    const errorPayload:
                        RoomErrorPayload = {
                        code: result.code,
                        message: result.message
                    };

                    socket.emit(
                        SOCKET_EVENTS.ROOM_ERROR,
                        errorPayload
                    );

                    return;
                }

                result.player.appearance =
                    profile.appearance;

                if (profile.username)
                {
                    result.player.name =
                        profile.username;
                }

                roomManager.setPlayerAppearance(
                    socket.id,
                    result.player.appearance
                );

                roomManager.setPlayerName(
                    socket.id,
                    result.player.name
                );

                if (result.previous)
                {
                    socket.leave(
                        socketRoom(
                            result.previous.roomId
                        )
                    );

                    const leftPayload:
                        PlayerLeftPayload = {
                        playerId:
                            result.previous.player.id
                    };

                    io.to(
                        socketRoom(
                            result.previous.roomId
                        )
                    ).emit(
                        SOCKET_EVENTS.PLAYER_LEFT,
                        leftPayload
                    );

                    console.log(
                        `[room] ${socket.id} left ${result.previous.roomId}`
                    );
                }

                socket.join(
                    socketRoom(
                        result.roomId
                    )
                );

                const statePayload:
                    RoomStatePayload = {
                    roomId: result.roomId,
                    selfId: socket.id,
                    players:
                        result.players
                };

                socket.emit(
                    SOCKET_EVENTS.ROOM_STATE,
                    statePayload
                );

                if (
                    previousRoomId !==
                    result.roomId
                )
                {
                    const joinedPayload:
                        PlayerJoinedPayload = {
                        player: result.player
                    };

                    socket.to(
                        socketRoom(
                            result.roomId
                        )
                    ).emit(
                        SOCKET_EVENTS.PLAYER_JOINED,
                        joinedPayload
                    );

                    console.log(
                        `[room] ${socket.id} joined ${result.roomId} as ${result.player.name}`
                    );
                }
            }
        );

        socket.on(
            SOCKET_EVENTS.PROFILE_APPEARANCE_SET,
            async (
                rawPayload: SetAppearancePayload
            ) =>
            {
                const profileId =
                    socket.data.profileId;

                if (
                    typeof profileId !== 'string' ||
                    !profileId
                )
                {
                    return;
                }

                try
                {
                    const profile =
                        await profileService.setAppearance(
                            profileId,
                            rawPayload.appearance
                        );

                    roomManager.setPlayerAppearance(
                        socket.id,
                        profile.appearance
                    );

                    const changedPayload:
                        PlayerAppearanceChangedPayload = {
                        playerId: socket.id,
                        appearance:
                            profile.appearance
                    };

                    const roomId =
                        roomManager.getRoomId(
                            socket.id
                        );

                    if (roomId)
                    {
                        io.to(
                            socketRoom(roomId)
                        ).emit(
                            SOCKET_EVENTS.PLAYER_APPEARANCE_CHANGED,
                            changedPayload
                        );
                    }
                }
                catch (error)
                {
                    console.error(
                        '[profile] failed to update appearance',
                        error
                    );
                }
            }
        );

        socket.on(
            SOCKET_EVENTS.PROFILE_USERNAME_SET,
            async (
                rawPayload: SetUsernamePayload
            ) =>
            {
                const profileId =
                    socket.data.profileId;

                if (
                    typeof profileId !== 'string' ||
                    !profileId
                )
                {
                    return;
                }

                try
                {
                    const profile =
                        await profileService.setUsername(
                            profileId,
                            rawPayload.username
                        );

                    roomManager.setPlayerName(
                        socket.id,
                        profile.username!
                    );

                    const changedPayload:
                        PlayerUsernameChangedPayload = {
                        playerId: socket.id,
                        username:
                            profile.username!
                    };

                    const roomId =
                        roomManager.getRoomId(
                            socket.id
                        );

                    if (roomId)
                    {
                        io.to(
                            socketRoom(roomId)
                        ).emit(
                            SOCKET_EVENTS.PLAYER_USERNAME_CHANGED,
                            changedPayload
                        );
                    }
                }
                catch (error)
                {
                    console.error(
                        '[profile] failed to update username',
                        error
                    );
                }
            }
        );

        socket.on(
            'disconnect',
            (reason) =>
            {
                const left =
                    roomManager.leave(
                        socket.id
                    );

                if (left)
                {
                    const leftPayload:
                        PlayerLeftPayload = {
                        playerId:
                            left.player.id
                    };

                    io.to(
                        socketRoom(
                            left.roomId
                        )
                    ).emit(
                        SOCKET_EVENTS.PLAYER_LEFT,
                        leftPayload
                    );

                    console.log(
                        `[room] ${socket.id} left ${left.roomId}`
                    );
                }

                console.log(
                    `[socket] disconnected: ${socket.id} (${reason})`
                );
            }
        );
    });

    return roomManager;
}