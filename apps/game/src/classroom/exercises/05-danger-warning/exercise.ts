import type { DrawCommand, LessonExercise, LessonFrame } from '../../contracts';

/** Ejercicio E: Aviso de peligro cercano. Lee README.md antes de empezar. */
export function createExercise(): LessonExercise {
    // TODO: declara aquí el estado privado que necesite esta instancia.
    return {
        update(_frame: LessonFrame): readonly DrawCommand[] {
            // TODO: Encuentra el cactus o trampa más cercano al borde de la nave propia y avisa cuando esté a menos de 100 px.
            return [];
        }
    };
}
