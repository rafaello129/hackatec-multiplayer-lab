# Lobby e invitaciones

Primera entrega del plan de nuevas funciones. Rama de trabajo: `codex/lobby-invitaciones`.

## Uso

1. Abre la raíz del cliente y escribe tu nombre.
2. Elige **Crear sala nueva** para generar un código, o escribe uno y pulsa **Entrar a la sala**.
3. Durante la partida, pulsa **Invitar**. El enlace contiene la sala, pero no tu nombre.
4. El invitado elige su propio nombre antes de ingresar.
5. **Volver al lobby** navega fuera de la partida y cierra su conexión.

En orígenes HTTP donde el portapapeles no está disponible, se muestra el enlace seleccionado para copiarlo manualmente. Para otros equipos, comparte un enlace con la IP LAN del host y configura el cliente con el servidor accesible mediante `VITE_SERVER_URL`.

Si se pierde la conexión durante la descarga inicial del juego, **Recargar y entrar** conserva el nombre y la sala y abre un documento nuevo para evitar la caché de la descarga fallida. Úsalo después de recuperar la conexión. Los fallos de conexión al servidor permiten reintentar directamente desde el formulario.

Los enlaces anteriores con `?room=...&name=...` siguen entrando directamente. Si solo llevan `room`, abren el formulario con esa sala precargada. El nombre explícito de la partida tiene prioridad sobre el nombre persistido del perfil; la apariencia guardada se conserva.

## Implementación

- No se agregan eventos ni contratos de red: se reutilizan `room:join`, `room:state` y `room:error`.
- El servidor crea salas al primer ingreso y mantiene la validación de capacidad y pertenencia.
- Un intento de ingreso espera como máximo 12 segundos por el servidor. Al fallar se limpian los listeners del lobby y se desconecta ese intento.
- Al aceptar al jugador, el snapshot inicial se entrega a Phaser; la escena no vuelve a emitir el mismo ingreso al arrancar.
- La reconexión posterior sigue siendo responsabilidad del flujo existente de la escena.
- La ocupación visible procede de los snapshots del servidor.
- Phaser se carga al iniciar una partida; el formulario no crea una instancia del juego.

## Validación

- 50 pruebas automáticas: 15 cliente, 33 servidor, 2 compartidas.
- Tests nuevos para enlaces sin nombre ni parámetros ajenos, códigos compatibles, un único ingreso, limpieza de listeners, sala llena y timeout.
- `npm test`, `npm run build` y `npm run check` aprobados.
- Smoke multicliente aprobado.
- Navegador: validación del formulario, creación de sala, invitación, dos jugadores, retorno al lobby, enlaces anteriores y copia alternativa en HTTP LAN.
- Prueba de capacidad: 32 clientes Socket.IO; el participante adicional recibe el mensaje de sala llena y el formulario permite otro intento.
- Presentación revisada a 1280×900 y 390×844.
- Pérdida de conexión durante la carga: mensaje claro y recuperación con **Recargar y entrar**, conservando nombre y sala; comprobado en navegador.

Las capturas y resultados de esta sesión se encuentran en `output/playwright/lobby/`. El build mantiene el aviso sobre el tamaño del módulo Phaser.

## Alcance pendiente

Esta entrega no incluye rondas, continuidad de estadísticas al reconectar, equipos, espectadores ni administración del profesor. Son las siguientes tareas del plan, con reglas y validación propias.
