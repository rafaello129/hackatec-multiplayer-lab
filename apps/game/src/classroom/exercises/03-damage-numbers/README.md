# Ejercicio C: Números de daño

Este documento es el Issue local completo. Lee también [la guía común](../../../../../../docs/CLASSROOM.md).

## Objetivo

Compara hp por id entre previousPlayers y players; cuando baja, crea un número flotante con la diferencia durante 700 ms.

## Archivos que puedes editar

Solo esta carpeta `apps/game/src/classroom/exercises/03-damage-numbers/`. Completa `exercise.ts` y crea aquí tus pruebas `exercise.test.ts`. Puedes añadir helpers en esta misma carpeta. No necesitas cambiar imports, registro, escena, CSS, servidor ni contratos.

## Espacio asignado

Mundo: encima de la nave dañada. Guarda los efectos pendientes dentro de createExercise.

## Criterios de aceptación

- El primer frame, una curación o una reaparición no generan daño ficticio.
- Cada bajada genera un solo número; un snapshot repetido no lo duplica.
- Los números suben y se desvanecen; su cantidad está limitada. No atribuyas un atacante: ese dato no está disponible.
- Exporta la misma función `createExercise` y conserva su firma.
- Deja intactos los ejercicios de los demás: no dependas de su implementación.

## Pruebas a escribir

Casos mínimos: 100→80, 80→80, 80→100, jugador nuevo y efecto caducado. Usa Vitest y llama a `createExercise().update(frame)` con datos ficticios; no necesitas Phaser ni servidor. Importa los tipos de `../../contracts` y los datos de red de `@hackatec/shared`.

Ejecuta desde la raíz `npm test`, `npm run build` y `npm run check`. Comprueba tu efecto jugando, recargando y volviendo al lobby. En el PR incluye una captura y el resultado de tus pruebas.
