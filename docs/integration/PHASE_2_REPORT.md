# Fase 2 — implementación

## Cambios integrados
- Mapa aleatorio por sala basado en `mapita`, compartido en `room:state` y liberado cuando la sala queda vacía.
- Renderizador `MapView` integrado con `ArenaScene`.
- Entrada por WASD, flechas y gamepad; Shift/R1 para dash.
- Cliente emite `player:input`; servidor calcula posición a intervalos de 50 ms y emite `player:moved`.
- Límite de entradas inactivas: 250 ms; velocidad base 185 px/s; dash x1.8, 250 ms de duración, 4 s de cooldown.
- Colisión circular con rectángulos de paredes, desplazamiento separado por ejes, límites jugables de la arena.
- Tipos y eventos compartidos.

## Límites intencionales
- Trampas, cactus, salud, disparos y respawn pertenecen a fase 3; ahora son elementos visuales.
- No hay predicción o interpolación de red: el movimiento es autoritativo y renderizado al recibir cambios.
- No se crearon pruebas automatizadas a solicitud del usuario.
- No se ejecutó build ni smoke test en runtime; no se afirma validación funcional.
- `main` no fue alterada.

## Comandos para ejecutar
```bash
git fetch origin
git checkout integration/full-game
npm ci
npm run dev
```
Abrir dos pestañas con `?room=hackatec&name=Ana` y `?room=hackatec&name=Luis`.
