# Ciclo de partidas y modos

## Máquina de estados autoritativa

Cada sala tiene una única máquina de estados del servidor:

`WAITING → VOTING → COUNTDOWN → PLAYING → RESULTS → WAITING/VOTING`

- Mínimo de jugadores: 2.
- Votación: 15 segundos. El servidor valida sala, cuenta y modo. Cada cuenta tiene un voto y puede cambiarlo, con intervalo mínimo de 250 ms.
- Empate: selección aleatoria entre los modos empatados. Sin votos: selección aleatoria entre todos los modos habilitados.
- Cuenta regresiva: 5 segundos.
- Resultados: 15 segundos; después la sala puede abrir una nueva votación automáticamente.
- El servidor genera la semilla y el mapa de la ronda.
- El primer jugador que entra es anfitrión; al desconectarse, el anfitrión pasa al siguiente jugador que permanece en la sala.
- Solo el anfitrión puede detener la partida o forzar una nueva. Detener la partida desactiva el inicio automático hasta el siguiente inicio forzado.
- Los jugadores que entran durante COUNTDOWN, PLAYING o RESULTS quedan como espectadores hasta la próxima ronda.

## Modos habilitados

| Modo | Duración máxima | Regla de victoria / eliminación |
|---|---:|---|
| Clásico | 5 min | Gana quien alcance 30 bajas o tenga más bajas al terminar. Respawn de 5 s. |
| Todos contra uno | 4 min | Los cazadores ganan al eliminar al Titan. El Titan gana si resiste o elimina las vidas de todos los cazadores. |
| Rocket para todos | 5 min | Solo ranura 6, lanzacohetes. |
| Battle Royale | 7.5 min | Último jugador vivo. No hay respawn. Si el tiempo se agota, se desempata por supervivientes y salud. |

Los valores son configurables en `packages/shared/src/config/balance.ts`.

## Todos contra uno

El servidor selecciona al azar un Titan. Su vida máxima es `500 + 100 × número de cazadores`. Cada cazador comienza con dos vidas. Al perder una vida reaparece tras 5 segundos; al perder la última se vuelve espectador. El Titan no reaparece. Si el Titan se desconecta, la ronda se cancela.

Los zombies están activos en Clásico y Todos contra uno.

## Battle Royale

La tormenta tiene cinco fases. Cada fase espera 30 segundos y se cierra durante 45 segundos. Los daños por segundo configurados son 2, 4, 8, 12 y 20. El círculo final tiene radio mínimo de 80 px. El servidor genera el centro y el radio, aplica daño fuera del círculo y registra las fases sobrevividas para progresión.

## Anfitrión y resultados

El menú del anfitrión permite seleccionar cualquiera de los cuatro modos, iniciar y detener la ronda. Los resultados incluyen colocación, bajas, muertes, asistencias y zombies eliminados, además del ganador.

## Pruebas automatizadas

Se cubren las transiciones de estado, votos, autenticación, límite de voto, resultados, desempate, espectador tardío, reglas de victoria, eliminación permanente de Battle Royale y límites de vidas del Titan. Las pruebas de cámara y percepción visual de los espectadores requieren validación manual.
