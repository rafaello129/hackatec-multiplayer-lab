# Verificación manual de una partida — HackaTec Multiplayer Lab

Este documento es una lista de aceptación **manual**, no una prueba automatizada. La compilación y el smoke test de Socket.IO no sustituyen la validación visual de una partida.

## Preparación
- Node.js 22 o superior.
- Ejecutar `npm ci && npm run dev` desde la raíz.
- Abrir `http://localhost:5173/?room=clase&name=Ana` y `http://localhost:5173/?room=clase&name=Luis` en dos navegadores/perfiles separados. Utilizar perfiles de navegador separados para que los identificadores persistentes no coincidan.
- Si se conecta desde otra PC, configurar `VITE_SERVER_URL` con la IP del equipo servidor y usar la IP del host de Vite.

## Recorrido de aceptación
- [ ] Ambos jugadores entran y se ven mutuamente con nombres e identificadores distintos.
- [ ] Ambos ven el mismo mapa (mismos obstáculos y posiciones).
- [ ] WASD/flechas mueven al jugador correcto y el otro cliente lo ve en tiempo real.
- [ ] No se atraviesan paredes ni límites; el dash (Shift) respeta cooldown.
- [ ] Una trampa inmoviliza cinco segundos; después permite salir sin volver a atraparlo indefinidamente.
- [ ] Los cactus reducen HP; el dash evita daño según regla de invulnerabilidad.
- [ ] Cambiar con 1/2/3 y disparar con clic: pistola, ametralladora y escopeta muestran proyectiles en ambos clientes.
- [ ] Disparar sobre otros jugadores reduce HP; al morir se cuentan kills/deaths y hay respawn tras tres segundos.
- [ ] El respawn no aparece encima de otro jugador o dentro de una pared, cuando hay una posición libre.
- [ ] Cambiar username, color y subir skin: el otro jugador ve la apariencia y los cambios sobreviven una recarga.
- [ ] El HUD refleja HP, muertes, kills y scoreboard.
- [ ] Clic en el panel de personalización no dispara accidentalmente.
- [ ] Desconectar y reconectar uno de los clientes no deja un jugador fantasma.
- [ ] Abrir una sala distinta aísla jugadores, proyectiles y mapa.

## Registro rápido
Anotar por cada casilla que falle: reproducción, navegador, sala, mensaje de consola y evidencia visual. No marcar ningún punto como superado sin ejecución real.

## Problemas conocidos y alcance
- La identidad de perfil local todavía no está autenticada; usar solo en demostraciones privadas.
- La subida de imágenes requiere más endurecimiento antes de exponer el servidor públicamente.
- El movimiento puede verse entrecortado sin interpolación.
- Las verificaciones de CI cubren compilación/Socket.IO, no esta lista visual.
