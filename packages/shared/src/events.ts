export const SOCKET_EVENTS = {
    CONNECTION_READY: 'connection:ready',

    ROOM_JOIN: 'room:join',
    ROOM_STATE: 'room:state',
    ROOM_ERROR: 'room:error',

    PLAYER_JOINED: 'player:joined',
    PLAYER_LEFT: 'player:left',
    PLAYER_INPUT: 'player:input',
    PLAYER_MOVED: 'player:moved',
    PLAYER_SHOOT: 'player:shoot',
    COMBAT_STATE: 'combat:state',
    PROFILE_SET: 'profile:set',
    PROFILE_RESULT: 'profile:result'
} as const;
