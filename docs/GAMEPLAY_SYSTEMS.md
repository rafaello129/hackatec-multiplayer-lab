# Sistemas de juego y balance

Esta página describe el balance que está configurado en `packages/shared/src/config/balance.ts`. El servidor conserva la autoridad de las acciones y utiliza estos valores al simular el juego.

## Armas

La selección de ranuras es fija:

| Ranura | Arma | Balance configurado |
|---:|---|---|
| 1 | Cuchillo | 28 de daño, alcance 70 px, cooldown 450 ms, arco de 60° |
| 2 | Metralleta | 8 de daño, cooldown 100 ms, velocidad de proyectil 770 px/s |
| 3 | Escopeta | 3 perdigones, 15 de daño por perdigón, cooldown 800 ms, velocidad 590 px/s |
| 4 | Pistola | 20 de daño, cooldown 500 ms, velocidad 640 px/s |
| 5 | Sniper | 80 de daño, alcance 1600 px, cooldown 1600 ms; impacto hitscan |
| 6 | Lanzacohetes | 55 de daño central, 15 en el borde, radio 110 px, cooldown 1400 ms, empuje |

Rocket para todos fuerza la ranura 6 y bloquea las demás. El cliente no puede elegir el arma enviando un campo arbitrario en el disparo.

## Movimiento y obstáculos

- Velocidad normal: 185 px/s.
- Dash: desplazamiento configurado de 170 px en 160 ms, invulnerabilidad durante 300 ms y cooldown de 2500 ms.
- La dirección del dash usa el movimiento; si el jugador está quieto, usa el ángulo de apuntado validado por el servidor.
- Las paredes bloquean movimiento y proyectiles.
- Las trampas inmovilizan durante 5 segundos.
- Los cactus aplican daño con un cooldown de 1 segundo.

La física de movimiento y las colisiones se ejecutan en el servidor, con un tick nominal de 50 ms.

## Vida, escudos y pickups

- Salud inicial y máxima normal: 100.
- Escudo máximo: 50.
- Botiquín: restaura hasta 40 puntos de salud.
- Pickup de escudo: restaura hasta 25 puntos.
- Los pickups reaparecen tras 60 segundos en modos normales y 120 segundos en Battle Royale.
- Una baja cura al atacante hasta 15 puntos, sin superar su salud máxima.
- La protección al reaparecer dura 1 segundo.

Un pickup que no puede beneficiar a un jugador (por ejemplo, un botiquín con salud completa) no se consume.

## Zombies

Los zombies aparecen exclusivamente en el modo Zombies. Clásico, Todos contra uno, Rocket para todos y Battle Royale no generan enemigos ni proyectiles de zombies. El máximo configurado es de 12 vivos, con intervalo de aparición de 20 segundos.

**Gigante**
- 400 de salud.
- Se aproxima al objetivo, anuncia una embestida durante 800 ms y carga a 420 px/s.
- La embestida hace 35 de daño.
- Cooldown de ataque: 6 segundos.
- Si la carga choca contra una pared, queda aturdido 2 segundos.

**Escupidor**
- 90 de salud.
- Prefiere mantener aproximadamente 300 px de distancia y huye si el jugador se acerca a menos de 130 px.
- Lanza proyectiles de ácido a 280 px/s, con 12 de daño al impacto.
- El charco dura 4 segundos, tiene radio 48 px y causa 6 de daño por segundo.

La IA, los objetivos, los proyectiles, el daño y la salud de los enemigos son autoritativos en el servidor.

## Tormenta de Battle Royale

- Cinco fases.
- Cada fase espera 30 segundos y se cierra durante 45 segundos.
- Daño fuera del círculo: 2, 4, 8, 12 y 20 por segundo según la fase.
- Radio final mínimo: 80 px.
- Quien queda eliminado pasa a espectador y no reaparece.
- La progresión registra las fases completadas que sobrevivió el jugador.

## Progresión

Las recompensas configuradas son:

| Acción | XP |
|---|---:|
| Baja de jugador | 50 |
| Asistencia | 20 |
| Zombie eliminado | 10 |
| Victoria | 150 |
| Segundo o tercer lugar | 75 |
| Fase de tormenta sobrevivida en Battle Royale | 25 |

La XP se calcula en el servidor al terminar la ronda y se persiste en SQLite. El cliente solo recibe el resultado para mostrarlo. Los mensajes de arena, chat, perfil, modos y armas se mantienen en `packages/shared/src/config/texts.ts` para evitar duplicar traducciones. Se requiere participación durante una parte de la ronda; el umbral usa un mínimo de 30 segundos y el 20% de la duración efectiva o prevista, según cuál corresponda al cierre.

La XP necesaria para avanzar desde el nivel (L) es:

[
XP_{siguiente} = \operatorname{round}(100 \times L^{1.5})
]

La cuenta conserva XP acumulada, nivel y XP restante dentro del nivel.

## Chat

- Máximo 120 caracteres por mensaje.
- Límite de 5 mensajes por cuenta cada 10 segundos.
- Historial en memoria de hasta 40 mensajes por canal.
- Canal general para la sala y canal separado para espectadores.
- Los mensajes se limpian de caracteres de control y se muestran como texto, no como HTML.

El historial es temporal y se pierde cuando la sala queda vacía o el servidor se reinicia.

## Valores de partida

| Regla | Configuración |
|---|---:|
| Mínimo de jugadores | 2 |
| Votación | 15 s |
| Cuenta regresiva | 5 s |
| Resultados | 15 s |
| Clásico | 5 min / 30 bajas |
| Todos contra uno | 4 min |
| Rocket para todos | 5 min |
| Battle Royale | 7.5 min |
| Zombies | 5 min |

Los valores se pueden ajustar en un solo sitio. Cualquier cambio de balance debe actualizar los tests y esta documentación.
