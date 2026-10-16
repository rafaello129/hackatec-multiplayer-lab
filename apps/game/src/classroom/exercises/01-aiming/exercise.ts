import type { DrawCommand, LessonExercise, LessonFrame } from '../../contracts';

/** Ejercicio A: Mira de apuntado. Lee README.md antes de empezar. */
export function createExercise(): LessonExercise {
    // TODO: declara aquí el estado privado que necesite esta instancia.
    return {
        update(_frame: LessonFrame): readonly DrawCommand[] {
            // TODO: Dibuja una cruz o un anillo en frame.pointer. Cambia su aspecto según frame.weapon.
            return [];
        }
    };
}
