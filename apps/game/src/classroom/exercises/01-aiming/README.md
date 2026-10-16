# Ejercicio A: Mira de apuntado

Este documento es el Issue local completo. Lee también [la guía común](../../../../../../docs/CLASSROOM.md).

## Objetivo

Dibuja una cruz o un anillo en frame.pointer. Cambia su aspecto según frame.weapon.

## Archivos que puedes editar

Solo esta carpeta `apps/game/src/classroom/exercises/01-aiming/`. Completa `exercise.ts` y crea aquí tus pruebas `exercise.test.ts`. Puedes añadir helpers en esta misma carpeta. No necesitas cambiar imports, registro, escena, CSS, servidor ni contratos.

## Espacio asignado

Mundo: usa las coordenadas del puntero directamente. No restes el desplazamiento de cámara.

## Criterios de aceptación

- No dibuja si pointer es null, editingProfile es true o la nave propia está muerta.
- Sigue el cursor al recorrer el mapa y después de recargar.
- Diferencia las tres armas sin modificar disparos ni controles.
- Exporta la misma función `createExercise` y conserva su firma.
- Deja intactos los ejercicios de los demás: no dependas de su implementación.

## Pruebas a escribir

Casos mínimos: puntero nulo, nave muerta y cambio de arma. Usa Vitest y llama a `createExercise().update(frame)` con datos ficticios; no necesitas Phaser ni servidor. Importa los tipos de `../../contracts` y los datos de red de `@hackatec/shared`.

Ejecuta desde la raíz `npm test`, `npm run build` y `npm run check`. Comprueba tu efecto jugando, recargando y volviendo al lobby. En el PR incluye una captura y el resultado de tus pruebas.
