import type { LessonDefinition } from './contracts';
import { createExercise as aiming } from './exercises/01-aiming/exercise';
import { createExercise as dashTrail } from './exercises/02-dash-trail/exercise';
import { createExercise as damageNumbers } from './exercises/03-damage-numbers/exercise';
import { createExercise as healthBars } from './exercises/04-health-bars/exercise';
import { createExercise as dangerWarning } from './exercises/05-danger-warning/exercise';
import { createExercise as zoneCompass } from './exercises/06-zone-compass/exercise';

// Instructor-owned integration. Students do not need to edit this registry.
export const exercises: readonly LessonDefinition[] = [
    { id: '01-aiming', layer: 'world', create: aiming },
    { id: '02-dash-trail', layer: 'world', create: dashTrail },
    { id: '03-damage-numbers', layer: 'world', create: damageNumbers },
    { id: '04-health-bars', layer: 'world', create: healthBars },
    { id: '05-danger-warning', layer: 'hud', create: dangerWarning },
    { id: '06-zone-compass', layer: 'hud', create: zoneCompass }
];
