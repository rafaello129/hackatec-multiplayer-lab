import type { DrawCommand, LessonExercise, LessonFrame } from '../../contracts';

/** Ejercicio D: Barras de vida de las naves. Lee README.md antes de empezar. */
export function createExercise(): LessonExercise {
    // TODO: declara aquí el estado privado que necesite esta instancia.
    return {
        update(_frame: LessonFrame): readonly DrawCommand[] {
            // TODO: Dibuja una barra pequeña de vida debajo de cada nave remota viva; calcula la proporción con hp y maxHp.
            return [];
        }
    };
}
