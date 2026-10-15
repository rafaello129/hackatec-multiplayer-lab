/**
 * Phase 1 extension point for future authoritative per-room simulation.
 * No timer, physics or gameplay is started in this phase.
 */
export interface GameClock
{
    now(): number;
}

export interface GameSession
{
    readonly roomId: string;
    /** Future server-owned step. deltaMs is elapsed simulation time. */
    step(deltaMs: number): void;
    /** Release resources when the final participant leaves the room. */
    dispose(): void;
}

export const systemGameClock: GameClock = {
    now: () => Date.now()
};
