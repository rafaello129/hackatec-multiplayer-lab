# HackaTec Multiplayer Lab

Juego web multijugador 2D desarrollado con TypeScript, Phaser 4, Node.js, Express, Socket.IO, SQLite y npm workspaces.

> **Estado de esta rama:** integración avanzada del juego completo. El desarrollo vive en `work/full-game-completion`; no se ha fusionado en `main`. La CI valida código, pruebas y smoke de Socket.IO. La aceptación visual en navegadores y la prueba física en LAN siguen pendientes.

## Qué incluye

- Registro, inicio y cierre de sesión con contraseñas Argon2id y sesiones persistentes en SQLite.
- Salas autenticadas, sincronización autoritativa, host, votación de modos y espectadores.
- Movimiento con colisiones, dash, trampas, pickups, vida y escudos.
- Siete ranuras de armas; daño, proyectiles, explosiones, curación y kills calculados por el servidor.
- Cuatro modos: Clásico, Todos contra uno, Rocket para todos y Battle Royale.
- Tormenta progresiva para Battle Royale.
- Zombies gigante y escupidor con IA autoritativa.
- XP, niveles, asistencias, historial de progresión y chat con canal de espectadores.
- HUD con hotbar, vida, escudo, roles, feed de eliminaciones, resultados, chat y burbujas de mensaje.

Consulta [el informe de cierre de Fase 11](docs/integration/PHASE_11_REPORT.md), [la auditoría histórica y las decisiones técnicas](docs/FULL_GAME_AUDIT.md), [la referencia de juego](docs/GAMEPLAY_SYSTEMS.md), [el ciclo de partidas](docs/MATCH_LIFECYCLE.md) y [autenticación](docs/AUTHENTICATION.md).

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- Git.

## Instalación y desarrollo local

```bash
git clone https://github.com/rafaello129/hackatec-multiplayer-lab.git
cd hackatec-multiplayer-lab
git switch work/full-game-completion
npm ci
npm run dev
```

El monorepo levanta:

- Servidor: `http://localhost:3001`.
- Cliente Phaser/Vite: `http://localhost:5173`.

Abre una URL con el mismo identificador de sala en varias pestañas o dispositivos:

```text
http://localhost:5173/?room=hackatec
```

Cada jugador debe registrarse o iniciar sesión con una cuenta distinta. El servidor obtiene el nombre visible de la cuenta autenticada; no confía en nombres enviados por el cliente.

Para iniciar servidor y cliente por separado:

```bash
npm run dev:server
npm run dev:game
```

El servidor crea `apps/server/storage/accounts.sqlite` automáticamente. Para cambiar su ubicación, configura `DB_PATH`.

## Controles

| Acción | Control |
|---|---|
| Moverse | WASD o flechas |
| Dash | Shift |
| Apuntar | Mouse |
| Disparar | Mantener clic izquierdo |
| Seleccionar arma | Teclas 1–7 |
| Abrir / enviar chat | Enter |
| Cerrar chat | Escape |
| Cambiar objetivo como espectador | A / D |

En el chat, los jugadores activos escriben en el canal general. Los espectadores escriben en el canal de espectadores.

## Modos de juego

- **Clásico:** ronda de 5 minutos o límite de 30 bajas; respawn de 5 segundos. Incluye zombies.
- **Todos contra uno:** un Titan con vida escalada contra cazadores con dos vidas; respawn de 5 segundos para cazadores que conservan vidas. Incluye zombies.
- **Rocket para todos:** todos usan exclusivamente el lanzacohetes; ronda de 5 minutos.
- **Battle Royale:** eliminación definitiva, tormenta de cinco fases y victoria del último superviviente. Duración máxima configurada de 7.5 minutos.

La votación se abre al haber dos jugadores. El anfitrión también puede elegir e iniciar un modo, o detener la partida. Consulta [MATCH_LIFECYCLE.md](docs/MATCH_LIFECYCLE.md) para reglas exactas.

## Seguridad y autoridad

El cliente envía intenciones. El servidor valida la sesión y decide movimiento, selección de armas, cadencias, daño, muertes, respawn, curación, pickups, tormenta, IA, votos, chat y XP.

- Las contraseñas se almacenan con Argon2id.
- Los tokens de sesión son aleatorios; SQLite conserva su hash.
- Socket.IO valida la sesión en la conexión y en cada paquete.
- El láser depende de la cuenta propietaria reservada como `Gueta`; esa reserva corresponde al primer registro exitoso del username y no verifica identidad personal.
- Chat, votos, cambio de arma y login tienen límites de frecuencia.

No publiques `accounts.sqlite` ni subas secretos o tokens al repositorio.

## Scripts

```bash
npm run dev
npm run dev:server
npm run dev:game
npm run build
npm test
npm run check
npm run smoke -w @hackatec/game
```

`npm run check` ejecuta pruebas y builds. El smoke de CI inicia el servidor, comprueba autenticación y aislamiento de salas, reúne 32 jugadores autenticados en una sola sala, inicia una ronda con los 32 y verifica que el servidor aplica un dash durante ese tick activo. Esto valida el roster y una acción sincronizada bajo ese tamaño, no una prueba de varios minutos con los 32 jugadores combatiendo.

## Arquitectura

```text
apps/
  game/       Phaser 4 + Vite + Socket.IO Client
  server/     Express + Socket.IO + SQLite
packages/
  shared/     Contratos, eventos, textos y balance
```

Regla de autoridad:

```text
CLIENTE: envía una intención
        |
        v
SERVIDOR: valida, simula y modifica el estado
        |
        v
CLIENTES: renderizan el estado aprobado
```

Los valores de armas, habilidades, tormenta, zombies, pickups, XP y chat están centralizados en `packages/shared/src/config/balance.ts`.

## Estado de aceptación

La ejecución de GitHub Actions [#41053021839](https://github.com/rafaello129/hackatec-multiplayer-lab/actions/runs/41053021839) aprobó tests, build y smoke de Socket.IO para el commit `2a1463d`, incluido un escenario de 32 cuentas autenticadas y movimiento autoritativo. Esto no sustituye la aceptación manual: la sensación del dash, legibilidad del HUD, interacción visual de cada modo y comportamiento en LAN quedan pendientes de la persona responsable de esa validación. Consulta el [informe de Fase 11](docs/integration/PHASE_11_REPORT.md) y la [lista de aceptación manual](docs/integration/MANUAL_GAMEPLAY_ACCEPTANCE.md). No marcar la aceptación visual como completada antes de esas pruebas.

No hacer merge a `main` sin autorización expresa.
