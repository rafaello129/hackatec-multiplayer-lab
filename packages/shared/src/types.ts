export interface PlayerInput {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    /** Keyboard dash state; older client code may still use shift. */
    dash?: boolean;
    shift?: boolean;
}

export interface PlayerState {
    id: string;
    name: string;
    x: number;
    y: number;
    color?: number;
    velocity?: number;
    angle?: number;
    hp?: number;
    maxHp?: number;
    isInvulnerable?: boolean;
    isDashing?: boolean;
    alive?: boolean;
    kills?: number;
    deaths?: number;
    immobilizedUntil?: number;
    appearance?: PlayerAppearance;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type ConnectionReadyPayload = {
    message: string;
    socketId: string;
};

export type JoinRoomPayload = {
    roomId: string;
    playerName?: string;
    profileId?: string;
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

export type RoomErrorCode = 'INVALID_ROOM' | 'ROOM_FULL' | 'AUTH_REQUIRED';

export type RoomErrorPayload = {
    code: RoomErrorCode;
    message: string;
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
export type WallObstacle = BaseMapObstacle & { type: 'wall' };
export type TrapObstacle = BaseMapObstacle & { type: 'trap' };
export type CactusObstacle = BaseMapObstacle & { type: 'cactus'; size: CactusSize; damage: number };
export type MapObstacle = WallObstacle | TrapObstacle | CactusObstacle;
export type GameMapState = { seed: number; width: number; height: number; obstacles: MapObstacle[] };
export type PlayerInputPayload = { input: PlayerInput };
export type PlayerMovedPayload = { player: PlayerState };

export type WeaponType = 'pistol' | 'machineGun' | 'shotgun';
export type ShootPayload = { angle: number; weapon: WeaponType };
export type ProjectileState = {
    id: string;
    ownerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    weapon: WeaponType;
};
export type CombatSnapshot = { players: PlayerState[]; projectiles: ProjectileState[] };

export type SkinAsset = { id: string; url: string; width: number; height: number };
export type PlayerAppearance = { mode: 'color' | 'skin'; colorHex: string; skin?: SkinAsset };
export type ProfileUpdatePayload = { username?: string; appearance?: PlayerAppearance };

export type GameMode = 'classic' | 'team' | 'zombies' | 'everyone-vs-one' | 'rockets';
export type MatchPhase = 'waiting' | 'voting' | 'countdown' | 'playing' | 'results';
export type MatchStatePayload = {
    roomId: string;
    phase: MatchPhase;
    mode: GameMode | null;
    hostId: string | null;
    votes: Record<string, GameMode>;
    voteEndsAt: number | null;
    startsAt: number | null;
    endsAt: number | null;
    results: Array<{ playerId: string; name: string; kills: number; deaths: number }>;
    message?: string;
};
export type MatchVotePayload = { mode: GameMode };
export type HostStartMatchPayload = { mode: GameMode };
