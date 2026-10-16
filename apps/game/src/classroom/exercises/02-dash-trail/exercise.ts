import type { DrawCommand, LessonExercise, LessonFrame } from '../../contracts';

/** Ejercicio B: Estela del dash. Lee README.md antes de empezar. */
export function createExercise(): LessonExercise {
    // TODO: declara aquí el estado privado que necesite esta instancia.
    return {
        update(_frame: LessonFrame): readonly DrawCommand[] {
            // TODO: Guarda muestras de posición de las naves con isDashing y dibuja una estela que desaparezca en 250 ms.
            return [];
        }
    };
}
