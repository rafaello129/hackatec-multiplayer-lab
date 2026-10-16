# Clase: seis contribuciones independientes

La base conserva el juego actual. Los seis ejercicios están **pendientes de implementar**: sus funciones devuelven `[]`, compilan y no dibujan nada. El docente ya tiene preparada la integración. Son mejoras visuales locales; las reglas, daño, movimiento y estado multijugador siguen bajo autoridad del servidor.

## Reparto

Cada carpeta contiene el Issue local completo en `README.md` y el esqueleto en `exercise.ts`.

| Alumno | Ejercicio / carpeta dentro de `apps/game/src/classroom/exercises/` | Rama sugerida | Nivel |
| --- | --- | --- | --- |
| A | [01-aiming](../apps/game/src/classroom/exercises/01-aiming/README.md): mira según arma | `codex/clase-a-mira` | Inicial |
| B | [02-dash-trail](../apps/game/src/classroom/exercises/02-dash-trail/README.md): estela del dash | `codex/clase-b-estela` | Intermedio |
| C | [03-damage-numbers](../apps/game/src/classroom/exercises/03-damage-numbers/README.md): daño flotante | `codex/clase-c-dano` | Intermedio |
| D | [04-health-bars](../apps/game/src/classroom/exercises/04-health-bars/README.md): barras remotas | `codex/clase-d-vida` | Inicial |
| E | [05-danger-warning](../apps/game/src/classroom/exercises/05-danger-warning/README.md): peligro cercano | `codex/clase-e-peligro` | Intermedio |
| F | [06-zone-compass](../apps/game/src/classroom/exercises/06-zone-compass/README.md): brújula al cruce | `codex/clase-f-brujula` | Inicial/intermedio |

## Antes de repartir

El docente debe guardar y publicar una base común que incluya estas carpetas y su integración, antes de que los alumnos creen sus ramas. Todos parten del mismo commit. No repartir ramas anteriores a esta preparación. Esta tarea no crea commits, Issues remotos ni PRs automáticamente.

Con cinco alumnos, deja el sexto ejercicio pendiente: no bloquea los demás. Se pueden fusionar los seis en cualquier orden, incluso con los demás sin completar.

## Acuerdo para evitar conflictos

- Cada alumno edita únicamente su carpeta: implementación, helpers y `exercise.test.ts`.
- El docente mantiene `contracts.ts`, `registry.ts`, `LessonSession.ts`, `LessonOverlay.ts` y `ArenaScene.ts`. Están conectados: los alumnos no deben registrarse de nuevo.
- No instalar dependencias ni editar `package.json`, lockfile, CSS global, servidor, eventos Socket.IO o tipos compartidos para estos ejercicios.
- No usar variables globales, DOM, Phaser, temporizadores reales ni listeners. El estado temporal vive dentro de `createExercise()` y utiliza `frame.time` / `frame.delta`.
- Los datos de entrada son de solo lectura. No modificar `players`, `map` ni otros ejercicios.
- Cada README asigna coordenadas o espacio visual. El HUD de E y F tiene espacios distintos para evitar que se tapen entre sí.

Estas fronteras reducen los conflictos de archivos; la revisión visual conjunta sigue siendo necesaria para detectar interferencias entre efectos.

## API que ya reciben

`createExercise()` crea una instancia por escena y ejercicio. Se vuelve a llamar al recibir un estado inicial de sala o al desconectar, así que los efectos temporales se limpian. No contiene la solución: completa su `update(frame)`.

`update` se ejecuta cada frame y devuelve un array de `DrawCommand`. `[]` significa no dibujar. El adaptador limpia el dibujo anterior y reutiliza textos; los efectos persistentes deben volver a emitirse mientras duren.

| Campo | Significado |
| --- | --- |
| `time`, `delta` | Milisegundos del reloj de Phaser y duración del frame. |
| `selfId`, `players` | Identidad propia y último estado conocido, usando los tipos de `@hackatec/shared`. |
| `previousPlayers` | Copia del frame anterior; vacío al iniciar/reconectar. Los snapshots pueden repetirse entre frames. |
| `map` | Dimensiones, obstáculos y zonas. `zones` es opcional. |
| `pointer` | Coordenadas del cursor en el mundo; `null` fuera del campo o con personalización abierta. |
| `weapon` | `pistol`, `machineGun` o `shotgun`. |
| `editingProfile` | Indica si se está editando la personalización. |

Comandos disponibles (ver tipos exactos en `contracts.ts`):

- `circle`: `x`, `y`, `radius`, `color` numérico.
- `rect`: `x`, `y`, `width`, `height`, `color` numérico; posición en esquina superior izquierda.
- `line`: `x`, `y`, `toX`, `toY`, `width`, `color` numérico.
- `text`: `x`, `y`, `text`, `color` CSS y `size` opcional; posición en esquina superior izquierda.
- Todos aceptan `alpha` opcional entre 0 y 1.

A–D dibujan en el mundo (2304 × 1536); la cámara transforma sus coordenadas. E–F dibujan en el HUD fijo (1024 × 768). No sumes el desplazamiento de cámara ni el margen vertical del campo. Limita las listas de efectos y la cantidad de textos; no generes arrays ilimitados.

## Desarrollo y entrega

1. Leer el README del ejercicio asignado y crear su rama desde la base publicada por el docente.
2. Completar únicamente su función y helpers locales. Probar con `npm run dev`.
3. Escribir pruebas Vitest dentro de su carpeta con frames ficticios y tiempo controlado. No necesitan navegador para probar la lógica.
4. Ejecutar `npm test`, `npm run build` y `npm run check` desde la raíz. El check repite pruebas y compilación.
5. Revisar `git diff`: el PR del alumno debe contener solo su carpeta. Añadir evidencia visual y resultados de pruebas al PR.
6. El docente integra el PR y comprueba los efectos combinados, el cambio de sala y la reconexión.

Plantilla de petición para un alumno o agente:

> Implementa el Issue local `apps/game/src/classroom/exercises/XX/README.md`. Edita únicamente esa carpeta. Conserva el contrato y la integración existentes. Añade pruebas de los criterios de aceptación, ejecuta las validaciones del repositorio y revisa el diff. No completes otros ejercicios.
