# Verificación manual de una partida — HackaTec Multiplayer Lab

Esta lista cubre la aceptación visual y de interacción. No es sustituida por las pruebas unitarias, la compilación ni el smoke test de Socket.IO. Marca una casilla únicamente después de ejecutarla y observar el resultado.

## Preparación

- Node.js 22 o superior y npm 10 o superior.
- En la raíz del repositorio: `npm ci && npm run dev`.
- Abrir `http://localhost:5173/?room=clase` en dos navegadores o perfiles separados.
- Crear o iniciar sesión con una cuenta distinta en cada perfil.
- Para probar desde otra PC, configurar `VITE_SERVER_URL` con la dirección LAN del servidor y permitir los puertos necesarios en el firewall.

## Acceso, perfiles y salas

- [ ] Registro con usuario válido y contraseña de al menos 8 caracteres.
- [ ] Inicio de sesión, recarga de página y recuperación de sesión persistente.
- [ ] Cierre de sesión invalida la sesión y requiere volver a autenticarse.
- [ ] Dos cuentas distintas se ven con su identidad correcta; el servidor no acepta nombres arbitrarios enviados por el cliente.
- [ ] Cambiar nombre y color de apariencia; comprobar que persisten tras recargar.
- [ ] Subir una skin válida y seleccionarla; comprobar que otro jugador la ve.
- [ ] Cambiar entre skin e identidad vectorial/color y comprobar que ambas apariencias se representan correctamente.
- [ ] Una sala distinta no muestra jugadores, proyectiles, chat ni estado de la primera sala.

## Mapa, movimiento y combate

- [ ] El terreno de arena cubre el área jugable; rocas, vegetación seca, cactus, cercas y obstáculos se muestran correctamente.
- [ ] Ambos clientes muestran el mismo mapa y las mismas posiciones de obstáculos.
- [ ] WASD y flechas mueven al jugador correcto; el otro cliente observa el movimiento.
- [ ] No se atraviesan paredes ni límites del mapa.
- [ ] Shift ejecuta el dash, respeta cooldown e invulnerabilidad.
- [ ] Las trampas inmovilizan durante el tiempo configurado y los cactus aplican daño con su cooldown.
- [ ] Probar las ranuras 1 a 7: cuchillo, metralleta, escopeta, pistola, sniper, lanzacohetes y láser.
- [ ] Verificar cadencias, proyectiles, impactos y daño entre dos clientes.
- [ ] El sniper muestra su trazador e impacto visual; el láser muestra el haz y consume energía durante su duración.
- [ ] Botiquines y escudos restauran los valores correctos; un pickup que no puede beneficiar al jugador no se consume.
- [ ] Las bajas, muertes, curación por baja y respawn se reflejan en ambos clientes.

## Emotes y HUD

- [ ] C ejecuta giro, V salto, B agacharse y N sacudida.
- [ ] Cada emote se reproduce en el cliente local y en el cliente remoto.
- [ ] Los emotes funcionan con la nave vectorial y con una skin personalizada.
- [ ] Tras cada emote, el jugador vuelve a su posición, ángulo y escala normales.
- [ ] Un jugador Titan conserva su tamaño después de usar los cuatro emotes.
- [ ] El botón de la esquina superior derecha alterna HUD completo y minimalista.
- [ ] El HUD minimalista conserva vida, escudo y armas, y oculta elementos secundarios.
- [ ] Al restaurar el HUD, vuelven a estar disponibles chat, votación y controles del anfitrión cuando corresponda.
- [ ] Chat, feed, scoreboard, resultados y estados de conexión siguen siendo legibles.

## Modos de juego

- [ ] Clásico: ronda, límite de bajas, combate y respawn.
- [ ] Todos contra uno: rol Titan y cazadores, salud y vidas correspondientes.
- [ ] Rocket para todos: todos usan el lanzacohetes y no pueden cambiar a otras armas.
- [ ] Battle Royale: tormenta de cinco fases, eliminación definitiva y espectadores.
- [ ] Zombies: aparecen gigantes y escupidores; la IA y sus ataques se sincronizan.
- [ ] En Clásico, Todos contra uno, Rocket para todos y Battle Royale no aparecen zombies.
- [ ] En modos distintos de Battle Royale no aparece la tormenta.

## Multijugador, reconexión y LAN

- [ ] Desconectar y reconectar un cliente no deja un jugador fantasma.
- [ ] Los espectadores no pueden moverse, disparar ni usar emotes como jugadores activos.
- [ ] Los eventos de una sala no afectan a otra.
- [ ] Probar dos computadoras conectadas a la misma red LAN.
- [ ] Probar una partida con varios jugadores y observar CPU, latencia, sincronización y estabilidad durante varios minutos.

## Registro de resultados

Por cada fallo, anotar: paso, sala, cuentas usadas (sin contraseñas ni tokens), navegador, reproducción, consola del cliente, logs del servidor y captura de pantalla o video cuando sea útil.

## Alcance de CI

CI comprueba pruebas automatizadas, compilación y smoke multicliente. El smoke test de 32 cuentas valida autenticación, roster y una acción autoritativa durante la ronda; no equivale a una partida prolongada de 32 jugadores combatiendo. No marcar las casillas visuales, de LAN o de rendimiento como completadas sin una ejecución real.
