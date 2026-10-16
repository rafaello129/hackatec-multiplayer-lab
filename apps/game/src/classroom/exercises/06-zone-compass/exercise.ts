import type { DrawCommand, LessonExercise, LessonFrame } from '../../contracts';

/** Ejercicio F: Brújula hacia el cruce. Lee README.md antes de empezar. */
export function createExercise(): LessonExercise {
    // TODO: declara aquí el estado privado que necesite esta instancia.
    return {
        update(_frame: LessonFrame): readonly DrawCommand[] {
            // TODO: Calcula dirección y distancia desde la nave propia al centro de la zona crossing; muestra una orientación de ocho direcciones y distancia.
            return [];
        }
    };
}
