export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type ConnectionReadyPayload = {
    message: string;
    socketId: string;
};

export type PlayerState = {
    id: string;
    name: string;
    x: number;
    y: number;
    color: number;
};

export type MapObstacleType = 'wall' | 'trap' | 'cactus';

export type CactusSize = 'small' | 'medium' | 'large';

export type BaseMapObstacle = {
    id: string;
    type: MapObstacleType;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type WallObstacle = BaseMapObstacle & {
    type: 'wall';
};

export type TrapObstacle = BaseMapObstacle & {
    type: 'trap';
};

export type CactusObstacle = BaseMapObstacle & {
    type: 'cactus';
    size: CactusSize;
    damage: number;
};

export type MapObstacle =
    | WallObstacle
    | TrapObstacle
    | CactusObstacle;

export type GameMapState = {
    seed: number;
    width: number;
    height: number;
    obstacles: MapObstacle[];
};

export type JoinRoomPayload = {
    roomId: string;
    playerName?: string;
};

export type RoomStatePayload = {
    roomId: string;
    selfId: string;
    players: PlayerState[];
    map: GameMapState;
};

export type PlayerJoinedPayload = {
    player: PlayerState;
};

export type PlayerLeftPayload = {
    playerId: string;
};

export type RoomErrorCode =
    | 'INVALID_ROOM'
    | 'ROOM_FULL';

export type RoomErrorPayload = {
    code: RoomErrorCode;
    message: string;
};
