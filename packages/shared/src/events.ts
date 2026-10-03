export const SOCKET_EVENTS = {
    CONNECTION_READY: 'connection:ready',

    ROOM_JOIN: 'room:join',
    ROOM_STATE: 'room:state',
    ROOM_ERROR: 'room:error',

    PLAYER_JOINED: 'player:joined',
    PLAYER_LEFT: 'player:left',
    
    PROFILE_APPEARANCE_SET: 'profile:appearance:set',
    PLAYER_APPEARANCE_CHANGED: 'player:appearanceChanged'
} as const;
