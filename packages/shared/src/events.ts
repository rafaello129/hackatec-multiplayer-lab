export const SOCKET_EVENTS = {
    CONNECTION_READY: 'connection:ready',

    ROOM_JOIN: 'room:join',
    ROOM_STATE: 'room:state',
    ROOM_ERROR: 'room:error',

    PLAYER_JOINED: 'player:joined',
    PLAYER_LEFT: 'player:left'
} as const;
