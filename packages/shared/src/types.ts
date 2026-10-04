export type ConnectionStatus =
    | 'connecting'
    | 'connected'
    | 'disconnected';

export type ConnectionReadyPayload = {
    message: string;
    socketId: string;
};

export type SkinAsset = {
    id: string;
    url: string;
    width: number;
    height: number;
};

export type PlayerAppearance = {
    mode: 'color' | 'skin';
    colorHex: string;
    skin?: SkinAsset;
};

export type SetAppearancePayload = {
    appearance: PlayerAppearance;
};

export type PlayerAppearanceChangedPayload = {
    playerId: string;
    appearance: PlayerAppearance;
};

export type SetUsernamePayload = {
    username: string;
};

export type PlayerUsernameChangedPayload = {
    playerId: string;
    username: string;
};

export type PlayerState = {
    id: string;
    name: string;
    x: number;
    y: number;
    color: number;
    appearance: PlayerAppearance;
};

export type JoinRoomPayload = {
    roomId: string;
    playerName?: string;
    profileId: string;
};

export type RoomStatePayload = {
    roomId: string;
    selfId: string;
    players: PlayerState[];
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