# AGENTS.md — HackaTec Multiplayer Lab

## Propósito

Este repositorio es un laboratorio educativo. La base multijugador ya funciona y las features del shooter se implementan durante la clase mediante Issues, ramas, agentes y Pull Requests.

## Stack

- TypeScript
- Phaser 4
- Socket.IO
- Express
- Vite
- Vitest
- npm workspaces

## Arquitectura

```text
apps/game       cliente Phaser + Socket.IO Client
apps/server     servidor Express + Socket.IO
packages/shared contratos de red y tipos compartidos
```

## Reglas obligatorias para cualquier agente

1. Lee el Issue completo antes de modificar código.
2. No dupliques eventos Socket.IO.
3. No dupliques tipos compartidos entre cliente y servidor.
4. Los contratos de red viven en `packages/shared`.
5. El servidor mantiene el estado compartido y decide las reglas autoritativas.
6. No instales dependencias sin justificarlo.
7. No modifiques archivos fuera del alcance de la tarea salvo que sea estrictamente necesario.
8. No implementes features pertenecientes a otros Issues.
9. Mantén TypeScript estricto y evita `any` innecesario.
10. Ejecuta `npm test` y `npm run build` antes de terminar.
11. Ejecuta `npm run check` cuando la tarea esté lista para revisión.
12. Revisa `git diff` antes de considerar una tarea terminada.

## Base que debe preservarse

No romper:

- `GET /health`;
- conexión Socket.IO;
- `room:join`;
- snapshot de sala;
- `player:joined`;
- `player:left`;
- aislamiento entre salas;
- reconexión;
- smoke test multicliente;
- ejecución LAN mediante `VITE_SERVER_URL`.

## Restricción educativa

La base termina deliberadamente con jugadores estáticos. No añadas movimiento, disparos, health, kills, respawn, obstáculos o scoreboard salvo que el Issue asignado lo pida.

Ejemplo: si trabajas en movimiento, no aproveches para implementar disparos.

## Validación mínima

```bash
npm test
npm run build
npm run check
```

Si modificas red o servidor, prueba además dos clientes reales o el smoke test existente.
