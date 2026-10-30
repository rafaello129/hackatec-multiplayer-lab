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
    shield?: number;
    isInvulnerable?: boolean;
    isDashing?: boolean;
    alive?: boolean;
    spectator?: boolean;
    kills?: number;
    deaths?: number;
    immobilizedUntil?: number;
    selectedWeapon?: WeaponType;
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
    hostId?: string;
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

export type WeaponType =
    | 'knife'
    | 'machineGun'
    | 'shotgun'
    | 'pistol'
    | 'sniper'
    | 'rocketLauncher'
    | 'laser';

export type ProjectileWeaponType = 'machineGun' | 'shotgun' | 'pistol' | 'rocketLauncher';
export type WeaponSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type WeaponSelectPayload = { slot: number };
export type WeaponFirePayload = { angle: number; firing: boolean };
/** @deprecated Use WeaponFirePayload; any legacy weapon field is ignored by the server. */
export type ShootPayload = WeaponFirePayload & { weapon?: WeaponType };
export type WeaponStatePayload = {
    selectedSlot: WeaponSlot;
    selectedWeapon: WeaponType;
    availableSlots: WeaponSlot[];
    cooldownRemainingMs: number;
    laserEnergyMs: number;
    laserEnergyMaxMs: number;
};
export type WeaponActionResultPayload = { ok: boolean; message: string };
export type ProjectileState = {
    id: string;
    ownerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    weapon: ProjectileWeaponType;
    createdAt?: number;
};
export type LaserBeamState = { ownerId: string; x1: number; y1: number; x2: number; y2: number };
export type ExplosionState = { id: string; x: number; y: number; radius: number; createdAt: number };
export type CombatSnapshot = {
    players: PlayerState[];
    projectiles: ProjectileState[];
    beams?: LaserBeamState[];
    explosions?: ExplosionState[];
};

export type SkinAsset = { id: string; url: string; width: number; height: number };
export type PlayerAppearance = { mode: 'color' | 'skin'; colorHex: string; skin?: SkinAsset };
export type ProfileUpdatePayload = { username?: string; appearance?: PlayerAppearance };

export type GameMode = 'classic' | 'team' | 'zombies' | 'everyone-vs-one' | 'rockets' | 'battleRoyale';
export type MatchPhase = 'waiting' | 'voting' | 'countdown' | 'playing' | 'results';
export type MatchStatePayload = {
    roomId: string;
    phase: MatchPhase;
    mode: GameMode | null;
    hostId: string | null;
    votes: Record<string, GameMode>;
    alivePlayerIds: string[];
    voteEndsAt: number | null;
    startsAt: number | null;
    endsAt: number | null;
    results: Array<{ playerId: string; name: string; kills: number; deaths: number }>;
    message?: string;
};
export type MatchVotePayload = { mode: GameMode };
export type HostStartMatchPayload = { mode: GameMode };

export type MatchActionResultPayload = { ok: boolean; message: string };
