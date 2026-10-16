# Ejercicio D: Barras de vida de las naves

Este documento es el Issue local completo. Lee también [la guía común](../../../../../../docs/CLASSROOM.md).

## Objetivo

Dibuja una barra pequeña de vida debajo de cada nave remota viva; calcula la proporción con hp y maxHp.

## Archivos que puedes editar

Solo esta carpeta `apps/game/src/classroom/exercises/04-health-bars/`. Completa `exercise.ts` y crea aquí tus pruebas `exercise.test.ts`. Puedes añadir helpers en esta misma carpeta. No necesitas cambiar imports, registro, escena, CSS, servidor ni contratos.

## Espacio asignado

Mundo: reserva x=player.x−24, y=player.y+42, ancho 48 y alto 5 para cada barra.

## Criterios de aceptación

- No duplica la barra propia del HUD ni dibuja naves muertas.
- Limita la proporción a 0..1; maneja hp ausente y maxHp cero sin NaN.
- Usa colores distintos para vida alta, media y baja; no modifica la vida real.
- Exporta la misma función `createExercise` y conserva su firma.
- Deja intactos los ejercicios de los demás: no dependas de su implementación.

## Pruebas a escribir

Casos mínimos: vida completa, baja, negativa, superior al máximo y máximo cero. Usa Vitest y llama a `createExercise().update(frame)` con datos ficticios; no necesitas Phaser ni servidor. Importa los tipos de `../../contracts` y los datos de red de `@hackatec/shared`.

Ejecuta desde la raíz `npm test`, `npm run build` y `npm run check`. Comprueba tu efecto jugando, recargando y volviendo al lobby. En el PR incluye una captura y el resultado de tus pruebas.
