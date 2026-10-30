# Ciclo de partidas — Fase 2

## Autoridad y estados

El servidor mantiene una máquina de estados por sala:

`LOBBY (waiting) → VOTING → COUNTDOWN → PLAYING → RESULTS → VOTING`

- Mínimo de jugadores: 2.
- Votación: 15 segundos. El servidor valida el modo, la pertenencia a la sala y la cuenta autenticada. Cada cuenta tiene un voto por votación y puede cambiarlo; los cambios están limitados por un intervalo mínimo de 250 ms.
- Empate: selección aleatoria entre los modos empatados. Sin votos: selección aleatoria entre los modos disponibles.
- Cuenta regresiva: 5 segundos.
- Clásico: 5 minutos por ronda o hasta que alguien alcance 30 bajas (límite configurable). Reaparición: 5 segundos.
- Resultados: 15 segundos antes de abrir la siguiente votación automáticamente.
- El servidor genera una nueva semilla y mapa al comenzar cada ronda y lo difunde a todos los clientes de la sala.

## Anfitrión

El primer jugador que entra es el anfitrión. Si se desconecta, el rol pasa al jugador que lleve más tiempo en la sala. Solo el anfitrión puede detener la partida o forzar el inicio de una nueva ronda. Detenerla desactiva el inicio automático hasta que el anfitrión fuerce otra ronda.

Los controles del anfitrión son voluntarios: no interrumpen partidas por sí solos. Las acciones se autorizan en el servidor; ocultar el menú en el cliente no es una medida de seguridad.

## Modos disponibles en esta fase

En esta fase solo está habilitado **Clásico**. Los modos Todos contra uno, Rocket para todos y Battle Royale pertenecen a fases posteriores y no se aceptan todavía como votos ni como órdenes de inicio. El menú del anfitrión ya utiliza un contrato de modo extensible.

## Jugadores que llegan tarde

Quien entra durante COUNTDOWN, PLAYING o RESULTS queda marcado como espectador y no puede moverse, disparar ni recibir daño de proyectiles. Al reiniciar la siguiente ronda se integra como jugador activo.

## Pruebas

- Unitarias de la máquina de estados, votos, rate limit, desempate, resultados, aislamiento entre salas, espectador tardío y sucesión de anfitrión.
- Smoke test Socket.IO con cuentas autenticadas: entrada de dos jugadores, votación sincronizada, inicio forzado por anfitrión, detención y transferencia de anfitrión.
- Validación CI con `npm run check` y smoke test de conexión.
