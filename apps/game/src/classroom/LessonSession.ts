import type { LessonDefinition, LessonFrame } from './contracts';

/** Owns history and student closures; no Phaser or Socket.IO dependencies. */
export class LessonSession {
    private instances;
    private previousPlayers: LessonFrame['previousPlayers'] = [];

    constructor(private readonly definitions: readonly LessonDefinition[]) {
        this.instances = definitions.map(definition => definition.create());
    }

    update(input: Omit<LessonFrame, 'previousPlayers'>) {
        const frame: LessonFrame = { ...input, previousPlayers: this.previousPlayers };
        const batches = this.instances.map(exercise => exercise.update(frame));
        // Copy: later server snapshots must not overwrite our previous frame.
        this.previousPlayers = structuredClone(input.players);
        return batches;
    }

    reset(): void {
        this.previousPlayers = [];
        this.instances = this.definitions.map(definition => definition.create());
    }
}
