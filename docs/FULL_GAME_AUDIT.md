# Auditoría inicial (snapshot histórico de Fase 0)

Fecha de auditoría: 2026-10-29. Este archivo registra el estado antes de la implementación de las fases 3–11; sus secciones de brechas y plan ya no describen el estado más reciente.

**Estado vivo:** consulta [GAMEPLAY_SYSTEMS.md](GAMEPLAY_SYSTEMS.md), [MATCH_LIFECYCLE.md](MATCH_LIFECYCLE.md) y el README. La rama actual integra armas, dash, pickups, cuatro modos, tormenta, zombies, progresión y chat. CI y smoke de 32 jugadores se mantienen como validación en curso; las pruebas visuales en navegador y LAN siguen pendientes.

Base: `work/phase-2-match-lifecycle-classic` / commit `b2f07ce187effc6599a79d0b3799c5855d3c5b9b`
Rama de trabajo: `work/full-game-completion`
Especificación: `prompt_extension_juego.pdf` (fases 0–11).

## 1. Estructura y arquitectura observadas

- Monorepo npm workspaces: `apps/game` (Phaser 4, TypeScript, Vite), `apps/server` (Express, Socket.IO, TypeScript) y `packages/shared` (tipos, eventos, balance y textos).
- El cliente captura intención de movimiento y disparo; el servidor mantiene posiciones, colisiones, proyectiles, daño, muertes y respawn.
- Las salas y sus mapas viven en memoria. `RoomManager` administra pertenencia, anfitrión y reinicio de mapa.
- `MatchManager` implementa una máquina de estados por sala. En esta base solo se admite `classic`.
- Las cuentas se guardan en SQLite mediante `node:sqlite`; las contraseñas se procesan con Argon2id. Las sesiones usan tokens aleatorios de 32 bytes, guardados como hash SHA-256, enviados en cookie HttpOnly de siete días. Socket.IO valida la sesión en el handshake y de nuevo en cada paquete.
- La identidad persistente es `userId`; el identificador de jugador enviado a la sala es el socket id efímero. No se difunde el token ni el hash de contraseña.
- `ArenaScene` todavía concentra captura de entrada, emisión de disparos, HUD y coordinación de vistas. Debe reducirse progresivamente a coordinación y delegar sistemas.
- El paquete compartido declara estado de jugador, apariencia, mapa, movimiento, tres armas, proyectiles, snapshot de combate, modos y ciclo de partida. Aún no declara contratos de pickups, escudos, armas nuevas, Titan, tormenta, zombies, chat ni XP.

## 2. Hallazgos funcionales frente al PDF

### Movimiento y mundo
- El servidor aplica movimiento normalizado por tick, timeout de entrada y colisión contra paredes.
- Las constantes de velocidad, radio y dash están repartidas en `movement.ts`, no en un balance central.
- El dash actual dura 250 ms, multiplica la velocidad por 1.8 y tiene cooldown de 4 s. No alcanza los 170 px en 0.16 s especificados, no apunta con el mouse al estar quieto y su invulnerabilidad no está modelada como la ventana de 0.3 s requerida.
- El mapa se genera con semilla del servidor e incluye paredes, trampas y cactus. No hay pickups.
- El sistema de trampa inmoviliza durante cinco segundos, pero todavía no difunde el contrato visual `player:trapped` ni expone un contador sincronizado.

### Combate y armas
- `CombatManager` mueve proyectiles y decide impactos y daño en el servidor.
- Armas actuales: pistola (500 ms, 20 de daño), metralleta (100 ms, 8) y escopeta (800 ms, tres perdigones de 15). Esos valores están dentro de `CombatManager.ts`, no en el balance compartido.
- El cliente usa 1=pistola, 2=metralleta, 3=escopeta y envía el tipo de arma en cada intención de disparo. No existe selección de slot validada por el servidor.
- La especificación requiere 1=cuchillo, 2=metralleta, 3=escopeta, 4=pistola, 5=sniper, 6=rocket launcher y 7=laser exclusivo para la cuenta Gueta.
- La muerte suma bajas y muertes y programa respawn a cinco segundos en la base actual. No hay escudo, curación por kill, hitscan de sniper, explosiones ni energía de laser.

### Partidas y modos
- La FSM soporta waiting/voting/countdown/playing/results y sincroniza cambios cada 50 ms.
- Votación, conteo, desempate, semilla de mapa, espectadores tardíos y resultados de Clásico ya están implementados.
- `AVAILABLE_GAME_MODES` solo contiene `classic`. Los modos `team`, `zombies`, `everyone-vs-one` y `rockets` aparecen como tipos, pero no como modos jugables. Battle Royale tampoco está en el tipo compartido.
- La lógica de fin de partida está orientada a tiempo/límite de bajas de Clásico; debe abstraerse para condiciones propias por modo.

### Enemigos, progresión e interfaz
- No hay sistema de zombies ni IA de enemigos en el código base de la rama auditada.
- SQLite ya crea tablas `progression` y `skins`, pero no hay servicio de XP/niveles ni adjudicación al final de partidas.
- No hay chat de sala ni canales de espectadores.
- El HUD actual es mínimo: vida, bajas/muertes y clasificación parcial. No hay hotbar 1–7, estado de escudo, cooldown visual, feed, podio o barra de XP.
- La pantalla de login/registro ya existe, pero no tiene todos los estados y controles visuales pedidos (por ejemplo mostrar/ocultar contraseña); la interfaz general aún no tiene un sistema de diseño global.

## 3. Seguridad y persistencia: puntos de partida y brechas

- Correcto: contraseñas Argon2id, token aleatorio de 256 bits, hash de sesión persistido, cookie HttpOnly, unicidad insensible a mayúsculas, errores genéricos de login y autenticación del socket.
- Correcto parcialmente: los intentos de login se limitan por IP (8 por ventana de 15 min), pero no hay límite por cuenta ni rate limit equivalente de registro.
- La ruta de consulta de sesión implementada es `GET /api/auth/session`; el PDF propone `GET /api/auth/me`. Se mantendrá compatibilidad y se añadirá el alias requerido.
- La cuenta `Gueta` se reserva para el primer registro exitoso del nombre, como está documentado. Esto no demuestra identidad personal; es exactamente la política de primera reclamación que ya protege el servidor.
- Se debe introducir un límite claro de repositorio/servicio de perfil para que el almacenamiento siga siendo reemplazable y agregar validación/rate limit a todos los eventos nuevos.
- El README del ZIP está desactualizado: describe una base educativa sin movimiento ni combate, a pesar de que la rama ya tiene ambos sistemas.

## 4. Pruebas existentes y estado de validación

Hay pruebas unitarias en shared, cliente y servidor: contratos, identidad de cliente, registro de jugadores, hash/sesiones y unicidad de username, configuración, generación de spawn, validación de entrada, RoomManager y MatchManager. CI también ejecuta un smoke test Socket.IO de varios clientes.

No hay aún pruebas de daño de armas avanzadas, daño de área, laser, dash de especificación, pickups, Titan, tormenta, zombies, XP, chat ni carga con 32 clientes. La CI verde histórica certifica el commit de Fase 2, no las funciones futuras ni la experiencia visual en navegador.

En este entorno, `npm run check` no pudo superar la compilación de shared porque el `npm ci` anterior quedó incompleto al no poder resolver `registry.npmjs.org` (EAI_AGAIN). Por tanto, no se atribuye ese fallo al código ni se declara una validación local satisfactoria. La validación de cada corte se hará con GitHub Actions cuando sea posible y con ejecución manual para la jugabilidad.

## 5. Contradicciones, ambigüedades y defaults

1. **Documento complementario ausente**: el PDF remite a `plan_sistema_color_multimedia_username.md` para reglas de apariencia y multimedia. Default: conservar el contrato actual de color hexadecimal/skin, restricciones de username documentadas y almacenamiento asociado a `userId`; no inventar nuevas categorías de personalización.
2. **Desconexión del Titan**: el PDF permite reasignarlo o cancelar según el modo. Default: terminar esa ronda como cancelada y pasar a resultados; evita convertir arbitrariamente a un cazador en Titan.
3. **Inactividad para XP**: el PDF no fija umbral. Default: definir actividad con señales verificables de juego recibidas por el servidor durante la ronda y documentar el umbral configurable; no aceptar XP indicada por el cliente.
4. **Modo zombies**: el PDF propone Clásico y Todos contra uno, y excluye Rocket para todos. Default: exactamente esos dos modos, sin zombies en Battle Royale hasta que la especificación lo pida.
5. **Dash quieto**: exige dirección del mouse, pero la intención de movimiento actual no contiene orientación. Default: agregar una intención de apuntado validada y limitada por servidor; el cliente no decidirá la posición final.

Ninguno de estos puntos impide comenzar con las armas o el refactor de balance. La falta del archivo complementario limita únicamente los detalles no reproducidos en el PDF y en el contrato existente.

## 6. Plan de ejecución ajustado al código

1. **Fase 0 — auditoría**: documentar esta base, las brechas, decisiones y riesgos. Hecho en este documento.
2. **Fases 1 y 2 — consolidación**: conservar cuentas y ciclo Clásico ya implementados; añadir compatibilidad HTTP `/me`, reforzar límites, corregir brechas de identidad/validación y ampliar tests sin romper contratos existentes.
3. **Fase 3 — armas**: centralizar balance; registro de armas y loadouts; slots 1–7; cuchillo, sniper, rocket con daño radial/empuje y laser continuo de Gueta; selección/cadencia/impacto validados en servidor.
4. **Fase 4 — dash, trampas y pickups**: dash con desplazamiento, colisión e invulnerabilidad limitada; estado atrapado sincronizado; botiquines, escudos, reaparecimiento seguro y curación por baja.
5. **Fase 5 — modos de equipo desigual y rockets**: abstracción de reglas de modo; Titan, cazadores/vidas y condiciones de victoria; Rocket para todos con loadout restringido y mapa ajustado.
6. **Fase 6 — Battle Royale**: tormenta de cinco fases, daño progresivo, eliminación sin respawn, espectadores y ganador único.
7. **Fase 7 — zombies**: IA autoritativa para gigante y escupidor, charcos de ácido, telegráficos, spawn por modo y límites de rendimiento.
8. **Fase 8 — XP y niveles**: fórmula, adjudicación autoritativa al cerrar ronda, persistencia SQLite y anti-inactividad.
9. **Fase 9 — HUD y chat**: hotbar, barras, leaderboard, feed, resultados, burbujas/panel de chat, rate limit y canal de espectadores.
10. **Fase 10 — rediseño global**: tokens CSS, login, lobby, votación, resultados y ajustes accesibles/responsivos; lista/capturas de pantallas disponibles.
11. **Fase 11 — cierre**: tests unitarios e integración por modo, seguridad, prueba de carga de 32 clientes, documentación operativa y lista explícita de pendientes/riesgos.

Cada corte se mantendrá en `work/full-game-completion`, con commits pequeños y CI. No se fusionará a `main` sin autorización.

## 7. Riesgos principales

- La integración de varias mecánicas autoritativas aumenta la complejidad del tick de 50 ms; habrá que medir y evitar trabajo por jugador/proyectil repetido innecesariamente.
- El estado actual de `ArenaScene` concentra responsabilidades; añadir sistemas sin extraer módulos haría difícil mantener pruebas y evitar divergencia cliente/servidor.
- La CI puede verificar tipos y pruebas automatizadas, pero no la sensación del dash, legibilidad real del HUD o juego simultáneo en navegadores/dispositivos físicos.
- La disponibilidad intermitente del registro npm impide por ahora una verificación local limpia; CI remota se usará como verificador reproducible.
- Sin el archivo complementario de apariencia no se pueden certificar requisitos que solo aparezcan allí.
