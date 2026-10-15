# Fase 3 — Informe de implementación

## Implementado
- Motor de combate autoritativo `CombatManager`, separado del cliente Phaser.
- Pistola (500 ms, 20 HP), ametralladora (100 ms, 8 HP), escopeta (800 ms, 3 perdigones de 15 HP).
- Peticiones de disparo validadas, cadencia controlada por servidor y proyectiles con movimiento y colisión por subpasos.
- Colisión de proyectiles contra paredes, límites y jugadores de la misma sala; se ignora al propietario.
- Salud inicial de 100, daño, invulnerabilidad temporal tras daño y durante dash.
- Muerte, contador kills/deaths y respawn a los 3 segundos.
- Cactus con daño de mapa; trampas inmovilizan durante 5 segundos.
- Eventos `player:shoot` y `combat:state`; render de balas y HUD ligero con vida, arma y estadísticas.
- Teclas 1/2/3 para armas y ratón para disparar; visuales del jugador indican muerte/dash.
- Reparación de un error de llaves en Socket.IO heredado de Fase 2 y eliminación de tipo duplicado en el paquete compartido.
- `main` no modificado.

## Pendientes y límites
- No se ejecutaron pruebas automatizadas (por petición del usuario).
- No se ha ejecutado compilación ni se ha probado el juego en navegador; la integración funcional requiere comprobación posterior.
- El HUD y los efectos visuales finales pertenecen a Fase 4.
- No incluye persistencia, tablas globales ni matchmaking.
- La simulación envía snapshots por sala cada 50 ms sin interpolación de red.
- Al permanecer encima de una trampa después del bloqueo, puede reactivarse la inmovilización; el balance de peligros puede afinarse posteriormente.
- La salud invulnerable no destruye proyectiles enemigos adicionales sin aplicar daño.
- Limitar origen de disparos, cadencia, IDs y valores de entrada seguirá siendo responsabilidad del servidor.

## Puesta en marcha
```bash
git fetch origin
git checkout integration/full-game
npm ci
npm run dev
```
Abrir dos pestañas con la misma `room`. WASD/flechas para mover, Shift para dash, 1/2/3 para cambiar arma y clic para disparar.

**Estado:** código de Fase 3 publicado; no certificado como compilado o jugable.
