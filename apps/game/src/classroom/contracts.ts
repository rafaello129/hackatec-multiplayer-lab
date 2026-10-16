import type { GameMapState, PlayerState, WeaponType } from '@hackatec/shared';

// Local presentation API, not a network contract. Reuse the shared game types.
export type ReadonlyData<T> = T extends object ? { readonly [K in keyof T]: ReadonlyData<T[K]> } : T;

export type LessonFrame = {
    readonly time: number;
    readonly delta: number;
    readonly selfId: string;
    readonly players: ReadonlyData<PlayerState[]>;
    readonly previousPlayers: ReadonlyData<PlayerState[]>;
    readonly map: ReadonlyData<GameMapState>;
    readonly pointer: Readonly<{ x: number; y: number }> | null;
    readonly weapon: WeaponType;
    readonly editingProfile: boolean;
};

export type DrawCommand = (
    | { kind: 'circle'; x: number; y: number; radius: number; color: number }
    | { kind: 'rect'; x: number; y: number; width: number; height: number; color: number }
    | { kind: 'line'; x: number; y: number; toX: number; toY: number; width: number; color: number }
    | { kind: 'text'; x: number; y: number; text: string; color: string; size?: number }
) & { alpha?: number };

export type LessonExercise = { update(frame: LessonFrame): readonly DrawCommand[] };
export type LessonDefinition = {
    readonly id: string;
    readonly layer: 'world' | 'hud';
    readonly create: () => LessonExercise;
};
