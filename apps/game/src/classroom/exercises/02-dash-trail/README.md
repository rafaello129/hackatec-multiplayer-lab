# Ejercicio B: Estela del dash

Este documento es el Issue local completo. Lee también [la guía común](../../../../../../docs/CLASSROOM.md).

## Objetivo

Guarda muestras de posición de las naves con isDashing y dibuja una estela que desaparezca en 250 ms.

## Archivos que puedes editar

Solo esta carpeta `apps/game/src/classroom/exercises/02-dash-trail/`. Completa `exercise.ts` y crea aquí tus pruebas `exercise.test.ts`. Puedes añadir helpers en esta misma carpeta. No necesitas cambiar imports, registro, escena, CSS, servidor ni contratos.

## Espacio asignado

Mundo: posición de cada nave. Mantén el estado dentro de createExercise, nunca a nivel global.

## Criterios de aceptación

- Solo emite muestras durante el dash; la estela anterior se desvanece después.
- Limita las muestras por jugador (por ejemplo 12) y elimina las caducadas.
- Una reconexión o cambio de sala no conserva estelas antiguas.
- Exporta la misma función `createExercise` y conserva su firma.
- Deja intactos los ejercicios de los demás: no dependas de su implementación.

## Pruebas a escribir

Casos mínimos: caducidad usando frame.time, límite de muestras y dos instancias independientes. Usa Vitest y llama a `createExercise().update(frame)` con datos ficticios; no necesitas Phaser ni servidor. Importa los tipos de `../../contracts` y los datos de red de `@hackatec/shared`.

Ejecuta desde la raíz `npm test`, `npm run build` y `npm run check`. Comprueba tu efecto jugando, recargando y volviendo al lobby. En el PR incluye una captura y el resultado de tus pruebas.
