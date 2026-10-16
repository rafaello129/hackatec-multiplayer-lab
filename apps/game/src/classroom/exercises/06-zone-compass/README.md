# Ejercicio F: Brújula hacia el cruce

Este documento es el Issue local completo. Lee también [la guía común](../../../../../../docs/CLASSROOM.md).

## Objetivo

Calcula dirección y distancia desde la nave propia al centro de la zona crossing; muestra una orientación de ocho direcciones y distancia.

## Archivos que puedes editar

Solo esta carpeta `apps/game/src/classroom/exercises/06-zone-compass/`. Completa `exercise.ts` y crea aquí tus pruebas `exercise.test.ts`. Puedes añadir helpers en esta misma carpeta. No necesitas cambiar imports, registro, escena, CSS, servidor ni contratos.

## Espacio asignado

HUD fijo: rectángulo reservado x=355, y=105, ancho=260, alto=18. Texto corto, tamaño 11.

## Criterios de aceptación

- Obtiene el destino de map.zones, sin coordenadas fijas; si falta, no dibuja.
- Distingue N, NE, E, SE, S, SO, O y NO; recuerda que Y crece hacia abajo.
- A menos de 80 px indica “En el cruce”; no mueve la nave ni cambia de cámara.
- Exporta la misma función `createExercise` y conserva su firma.
- Deja intactos los ejercicios de los demás: no dependas de su implementación.

## Pruebas a escribir

Casos mínimos: ocho direcciones, destino ausente y llegada al centro. Usa Vitest y llama a `createExercise().update(frame)` con datos ficticios; no necesitas Phaser ni servidor. Importa los tipos de `../../contracts` y los datos de red de `@hackatec/shared`.

Ejecuta desde la raíz `npm test`, `npm run build` y `npm run check`. Comprueba tu efecto jugando, recargando y volviendo al lobby. En el PR incluye una captura y el resultado de tus pruebas.
