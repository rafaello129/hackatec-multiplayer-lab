# Ejercicio E: Aviso de peligro cercano

Este documento es el Issue local completo. Lee también [la guía común](../../../../../../docs/CLASSROOM.md).

## Objetivo

Encuentra el cactus o trampa más cercano al borde de la nave propia y avisa cuando esté a menos de 100 px.

## Archivos que puedes editar

Solo esta carpeta `apps/game/src/classroom/exercises/05-danger-warning/`. Completa `exercise.ts` y crea aquí tus pruebas `exercise.test.ts`. Puedes añadir helpers en esta misma carpeta. No necesitas cambiar imports, registro, escena, CSS, servidor ni contratos.

## Espacio asignado

HUD fijo: rectángulo reservado x=28, y=105, ancho=300, alto=18. Texto corto, tamaño 11.

## Criterios de aceptación

- Ignora las rocas y calcula distancia al rectángulo del obstáculo, no solo al centro.
- Incluye tipo y distancia; oculta el aviso si no hay peligro cercano o la nave está muerta.
- No cambia daño ni colisiones; no acumula texto por frame.
- Exporta la misma función `createExercise` y conserva su firma.
- Deja intactos los ejercicios de los demás: no dependas de su implementación.

## Pruebas a escribir

Casos mínimos: mapa vacío, solo rocas, peligro dentro/fuera del umbral y nave dentro del rectángulo. Usa Vitest y llama a `createExercise().update(frame)` con datos ficticios; no necesitas Phaser ni servidor. Importa los tipos de `../../contracts` y los datos de red de `@hackatec/shared`.

Ejecuta desde la raíz `npm test`, `npm run build` y `npm run check`. Comprueba tu efecto jugando, recargando y volviendo al lobby. En el PR incluye una captura y el resultado de tus pruebas.
