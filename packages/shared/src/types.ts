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