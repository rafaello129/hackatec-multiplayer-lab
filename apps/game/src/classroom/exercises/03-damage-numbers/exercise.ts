import type { DrawCommand, LessonExercise, LessonFrame } from '../../contracts';

/** Ejercicio C: Números de daño. Lee README.md antes de empezar. */
export function createExercise(): LessonExercise {
    // TODO: declara aquí el estado privado que necesite esta instancia.
    return {
        update(_frame: LessonFrame): readonly DrawCommand[] {
            // TODO: Compara hp por id entre previousPlayers y players; cuando baja, crea un número flotante con la diferencia durante 700 ms.
            return [];
        }
    };
}
