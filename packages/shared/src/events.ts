export const SOCKET_EVENTS = {
    CONNECTION_READY: 'connection:ready',

    ROOM_JOIN: 'room:join',
    ROOM_STATE: 'room:state',
    ROOM_ERROR: 'room:error',
    ROOM_HOST_CHANGED: 'room:host-changed',
    ROOM_MAP: 'room:map',
    MATCH_STATE: 'match:state',
    MATCH_VOTE: 'match:vote',
    MATCH_HOST_START: 'match:host-start',
    MATCH_HOST_STOP: 'match:host-stop',
    MATCH_ACTION_RESULT: 'match:action-result',

    PLAYER_JOINED: 'player:joined',
    PLAYER_LEFT: 'player:left',
    PLAYER_INPUT: 'player:input',
    PLAYER_MOVED: 'player:moved',
    PLAYER_SHOOT: 'player:shoot',
    COMBAT_STATE: 'combat:state',
    PLAYER_TRAPPED: 'player:trapped',
    PLAYER_HEALED: 'player:healed',
    PICKUP_STATE: 'pickup:state',
    PICKUP_COLLECTED: 'pickup:collected',
    STORM_STATE: 'storm:state',
    PROFILE_SET: 'profile:set',
    PROFILE_RESULT: 'profile:result',

    WEAPON_SELECT: 'weapon:select',
    WEAPON_FIRE: 'weapon:fire',
    WEAPON_STATE: 'weapon:state',
    WEAPON_RESULT: 'weapon:result'
} as const;
