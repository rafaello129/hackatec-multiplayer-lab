export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shift: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  velocity: number;
  angle: number;
  isInvulnerable: boolean;
}
export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shift: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  velocity: number;
  angle: number;
  hp: number;
  maxHp: number;
  isInvulnerable: boolean;
}
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type ConnectionReadyPayload = {
    message: string;
    socketId: string;
};

export type JoinRoomPayload = {
    roomId: string;
    playerName?: string;
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

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shift: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  velocity: number;
  angle: number;
  hp: number;
  maxHp: number;
  isInvulnerable: boolean;
}