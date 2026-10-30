# Lista de aceptación del juego completo

Estado de referencia: rama `work/full-game-completion`. Esta lista separa implementación, validación automatizada y aceptación manual.

## Fases de implementación

- [x] **Fase 0 — auditoría:** brechas, decisiones, riesgos y plan registrados en `FULL_GAME_AUDIT.md` (snapshot histórico).
- [x] **Fase 1 — cuentas:** registro, inicio/cierre de sesión, Argon2id, SQLite, cookies HttpOnly, alias `/api/auth/me`, identidad persistente, rate limits y un jugador por cuenta en cada sala.
- [x] **Fase 2 — ciclo de partidas:** WAITING, VOTING, COUNTDOWN, PLAYING, RESULTS; anfitrión, votos, cambios de voto, desempate, espectadores tardíos, mapa con semilla y desconexiones.
- [x] **Fase 3 — armas:** cuchillo, metralleta, escopeta, pistola, sniper, lanzacohetes y láser; slots y reglas autoritativas en el servidor.
- [x] **Fase 4 — habilidades/objetos:** dash con invulnerabilidad limitada, trampas, cactus, botiquines, escudos, respawn y curación al eliminar.
- [x] **Fase 5 — modos:** Todos contra uno y Rocket para todos, además de Clásico.
- [x] **Fase 6 — Battle Royale:** círculo seguro, tormenta de cinco fases, daño progresivo, eliminación definitiva y espectador.
- [x] **Fase 7 — zombies:** gigante y escupidor con IA, proyectiles y charcos de ácido calculados en servidor.
- [x] **Fase 8 — progresión:** XP, niveles, persistencia, elegibilidad por actividad, bajas, asistencias, zombies, victorias y supervivencia de tormenta.
- [x] **Fase 9 — HUD/chat:** barras de salud/escudo, armas, clasificación, feed de eliminaciones, resultados, XP, chat general y canal de espectadores.
- [ ] **Fase 10 — rediseño UI global (parcial):** ya hay sistema visual oscuro/responsivo para autenticación, mostrar/ocultar contraseña, panel de perfil desplegable, skins dibujadas por Phaser y marco de arena extraído a componente. Falta aplicar una jerarquía visual equivalente a todos los paneles HUD, votación y resultados, y validar cada pantalla en navegador.
- [x] **Fase 11 — cierre técnico:** pruebas unitarias, TypeScript, build, health check y smoke Socket.IO automatizado.

## Validación automatizada

- [x] Registro, login y rechazo de sockets sin sesión.
- [x] Alias `/api/auth/me` y rate limit de login por IP y cuenta.
- [x] Perfil actualizado: un socket nuevo ve el nombre persistido, no el nombre antiguo del handshake.
- [x] Skins: subida autenticada, archivo ligado al dueño en SQLite, rechazo de skins de otras cuentas, formatos inválidos y archivos demasiado grandes.
- [x] Votación, transición y espectadores tardíos.
- [x] Chat general, canal de espectadores, sanitización y rechazo de espectadores intentando publicar en el canal general.
- [x] Aislamiento entre salas y sucesión de anfitrión.
- [x] Roster de 32 cuentas distintas autenticadas, bloqueo de una misma cuenta duplicada en la sala, inicio de ronda, estado de combate con 32 jugadores y dash autoritativo.
- [x] Prueba corta de movimiento bajo esa carga: 928 intenciones en 1,501 ms (aproximadamente 618 intenciones/s) en la ejecución registrada.
- [x] Zombies: spawn disponible con 32 jugadores.
- [x] La CI más reciente ejecuta tests, build y smoke completo; revisa la ejecución enlazada desde el Pull Request o la pestaña Actions de esta rama.

**Alcance real del smoke de carga:** usa 32 conexiones Socket.IO simultáneas, cada una con una cuenta autenticada distinta. CI aumenta temporalmente el límite de registros para sembrar cuentas sintéticas; el valor por defecto de producción sigue siendo 8 registros por IP y hora. El intervalo de estrés es corto y no mide memoria, latencia percentil ni estabilidad de una partida larga con 32 personas disparando a la vez.

## Aceptación manual pendiente

- [ ] Abrir dos o más navegadores y comprobar login, registro, cierre de sesión y reconexión en pantallas reales.
- [ ] Recorrer todos los modos con jugadores humanos: armas, límites, respawn, Titan/cazadores, lanzacohetes y Battle Royale.
- [ ] Comprobar visualmente dash, obstáculos, trampas, pickups, salud/escudo y skins.
- [ ] Revisar cámara de espectador, chat, burbujas, feed, resultados y transiciones entre rondas.
- [ ] Probar en LAN desde equipos distintos y comprobar cookies/CORS con la configuración real de despliegue.
- [ ] Hacer una sesión sostenida con 32 clientes reales o automatizados disparando y moviéndose, y medir CPU, memoria, latencia y desconexiones.
- [ ] Revisar el juego en resoluciones/ventanas diferentes; el canvas conserva su proporción mediante Phaser Scale.FIT, pero la legibilidad final debe comprobarse en navegador.
- [ ] Ejecutar revisión final de seguridad y configuración de producción.

## Fuente complementaria ausente

La especificación menciona un archivo de diseño complementario llamado `plan_sistema_color_multimedia_username.md`. No está presente en la copia del repositorio revisada. El perfil actual conserva las opciones existentes de color y skin, y las reglas de username ya documentadas; no se han inventado requisitos adicionales para sustituir ese archivo.

## Estado de publicación

La implementación permanece en `work/full-game-completion`. `main` sigue intacta. No se ha hecho merge. No declarar el juego aceptado visualmente ni listo para producción hasta completar los puntos manuales y las decisiones pendientes del archivo complementario.
