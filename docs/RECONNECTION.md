# Reconexión con continuidad

El servidor reserva al jugador durante 30 segundos después de perder el transporte. La reconexión automática y la recarga de la misma pestaña recuperan identidad, sala, mapa, posición, vida, bajas, muertes y los temporizadores de combate. No se emite otro `player:joined` al recuperar al jugador.

El personaje desconectado se muestra atenuado con la etiqueta «reconectando». Se detienen su movimiento y dash, pero sigue recibiendo daño y su respawn continúa. Su plaza cuenta para el límite de la sala. Al vencer el plazo se emite `player:left`; si era el último jugador, se elimina también el mapa.

«Volver al lobby» desconecta explícitamente y elimina la credencial: es una salida definitiva. Un reinicio del servidor también termina las sesiones, que se mantienen en memoria.

## Contrato y credencial

`connection:ready` añade `sessionToken`, `recovered` y `recoveryWindowMs`. El cliente presenta el token en el campo `auth.sessionToken` del siguiente handshake. Es una credencial privada aleatoria de 256 bits: nunca aparece en snapshots de sala. Se guarda en `sessionStorage`, separada por URL del servidor; si el almacenamiento está bloqueado, la reconexión automática usa memoria, pero no puede sobrevivir a una recarga.

El token solo recupera una sesión desconectada y vigente. Una pestaña duplicada con un token todavía activo recibe otra identidad. El nombre y el identificador de perfil no permiten recuperar una sesión. El `selfId` del snapshot es la identidad estable del jugador; después de recuperar puede ser distinto de `socket.id`.

`PlayerState.connected` indica la presencia. Los clientes antiguos pueden omitir este campo y continúan siendo compatibles. No se añaden eventos Socket.IO nuevos.

## Validación reproducible

```bash
npm run check
node apps/game/scripts/smoke-reconnection.mjs
npm run smoke -w @hackatec/game
```

El nuevo smoke arranca un servidor aislado con clientes Socket.IO reales. Comprueba recuperación de transporte, identidad y mapa, credenciales privadas, duplicados, aislamiento, daño desconectado, muerte/respawn, salida explícita y caducidad. Usa una ventana breve para probar la caducidad y un escenario de combate sin obstáculos aleatorios. Requiere compilar primero el servidor con `npm run build` o `npm run check`.
