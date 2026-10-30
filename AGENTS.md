# AGENTS.md — HackaTec Multiplayer Lab

## Estado y alcance

Este repositorio contiene un juego web multijugador 2D en desarrollo activo. La implementación integrada vive en la rama `work/full-game-completion`. No asumir que la base termina con jugadores estáticos: ya existen autenticación, salas, movimiento, combate, modos, progresión, HUD, perfiles, skins y sistemas PvE.

## Stack

- TypeScript estricto y npm workspaces
- Phaser 4 + Vite en `apps/game`
- Express + Socket.IO + SQLite en `apps/server`
- Contratos, eventos, textos y balance compartidos en `packages/shared`
- Vitest para pruebas

## Reglas obligatorias

1. Trabaja exclusivamente en `work/full-game-completion`, salvo autorización expresa del responsable del proyecto.
2. Nunca modifiques, fusiones ni envíes cambios a `main` sin autorización explícita.
3. Antes de cambiar código, inspecciona la implementación actual, sus tipos compartidos y pruebas relacionadas.
4. Los contratos de red, nombres de eventos y tipos compartidos viven en `packages/shared`; no dupliques contratos entre cliente y servidor.
5. El servidor es autoritativo para autenticación, movimiento, colisiones, armas, cadencias, daño, muertes, respawn, pickups, tormenta, IA, votos, chat y XP.
6. Trata todos los datos enviados por el cliente como no confiables. Valida sala, identidad, estado del jugador, rangos, enumeraciones y frecuencia en el servidor.
7. No expongas secretos, tokens, hashes de sesión ni datos privados de cuentas en snapshots públicos, logs o respuestas.
8. No agregues dependencias sin justificar su necesidad.
9. Evita `any` y mantén TypeScript estricto.
10. Conserva compatibilidad con cuentas existentes y datos persistidos; cualquier migración SQLite debe ser segura y repetible.
11. Actualiza pruebas y documentación cuando cambies balance, controles, eventos o comportamiento visible.
12. No afirmes que una función se ve o funciona en pantalla sin ejecutar el juego y verificarla. Distingue pruebas automatizadas, smoke tests y aceptación manual.
13. No cambies balance o comportamiento solicitado por el responsable sin explicar el motivo y obtener autorización cuando sea un cambio de diseño.

## Arquitectura

```text
apps/game       cliente Phaser + Socket.IO Client
apps/server     Express + Socket.IO + SQLite
packages/shared contratos, eventos, textos y balance
```

El cliente envía intenciones; el servidor valida y simula; los clientes representan el estado aprobado. Los sistemas de zombies son exclusivos del modo Zombies y la tormenta es exclusiva de Battle Royale.

## Validación

Antes de terminar una modificación:

```bash
npm test
npm run build
npm run check
```

Si el cambio afecta red, autenticación o simulación, ejecuta también el smoke test multicliente. Si cambia interfaz, controles, animaciones o mapa, registra explícitamente si se realizó o no una verificación visual real.

## Documentación relevante

- `docs/GAMEPLAY_SYSTEMS.md`: balance y reglas de juego.
- `docs/MATCH_LIFECYCLE.md`: ciclo de vida de las partidas.
- `docs/AUTHENTICATION.md`: cuentas y sesiones.
- `docs/integration/MANUAL_GAMEPLAY_ACCEPTANCE.md`: pruebas visuales/manuales.
- `docs/integration/PHASE_11_REPORT.md`: informe de integración.

No marcar la aceptación visual o la prueba física en LAN como completadas solo porque CI esté verde.
