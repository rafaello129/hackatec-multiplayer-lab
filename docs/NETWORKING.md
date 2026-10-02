# Networking — HackaTec Multiplayer Lab

## Objetivo

Durante la clase, la PC del profesor ejecuta el servidor central y cada PC de alumno ejecuta su propio cliente Phaser.

```text
                 PC PROFESOR
             Node + Socket.IO
                0.0.0.0:3001
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
       PC Ana     PC Luis    PC Sofía
       Phaser     Phaser     Phaser
```

Todos pueden entrar a la misma sala y ver los mismos jugadores.

## 1. Profesor: instalar

```bash
git clone https://github.com/rafaello129/hackatec-multiplayer-lab.git
cd hackatec-multiplayer-lab
npm ci
```

## 2. Profesor: levantar el servidor

```bash
npm run dev:server
```

Debe escuchar en:

```text
0.0.0.0:3001
```

## 3. Profesor: localizar IPv4

En Windows:

```powershell
ipconfig
```

Ejemplo:

```text
192.168.1.25
```

Usa la IPv4 de la interfaz conectada a la misma red que los alumnos.

## 4. Alumno: probar HTTP antes del juego

Abre:

```text
http://192.168.1.25:3001/health
```

Debe responder:

```json
{
  "ok": true,
  "service": "hackatec-multiplayer-server"
}
```

También puede comprobarse:

```powershell
Test-NetConnection 192.168.1.25 -Port 3001
```

Si esta prueba falla, todavía no tiene sentido depurar Phaser.

## 5. Alumno: configurar servidor

Crea:

```text
apps/game/.env.local
```

con:

```env
VITE_SERVER_URL=http://192.168.1.25:3001
```

Después:

```bash
npm run dev:game
```

Importante: reinicia Vite después de modificar `.env.local`.

## 6. Entrar a la sala de clase

Ejemplo alumno A:

```text
http://localhost:5173/?room=hackatec&name=Ana
```

Alumno B:

```text
http://localhost:5173/?room=hackatec&name=Luis
```

Profesor como cliente opcional:

```text
http://localhost:5173/?room=hackatec&name=Rafael
```

Todos deben mostrar:

- `Sala: hackatec`;
- mismo número de jugadores;
- mismos nombres;
- estado `CONNECTED`.

## 7. Prueba de desconexión

Cierra una pestaña o detén el cliente.

Los demás deben eliminar a ese jugador automáticamente.

Vuelve a abrirlo.

Debe reaparecer sin reiniciar el servidor.

## 8. Probar aislamiento

Abre dos clientes en:

```text
?room=hackatec
```

y otro en:

```text
?room=otra
```

El jugador de `otra` no debe aparecer en `hackatec`.

## Diagnóstico

### /health no responde

Revisar en orden:

1. servidor del profesor está ejecutándose;
2. IPv4 correcta;
3. misma red;
4. puerto 3001;
5. Firewall de Windows;
6. aislamiento de clientes de la red Wi-Fi.

### /health funciona pero Phaser dice DISCONNECTED

Revisar:

1. `apps/game/.env.local`;
2. `VITE_SERVER_URL`;
3. reiniciar Vite;
4. consola del navegador;
5. logs del servidor.

### Un jugador no aparece

Revisar:

1. ambos usan exactamente el mismo `room`;
2. ambos muestran `CONNECTED`;
3. logs del servidor muestran `joined <room>`;
4. no hay un error `INVALID_ROOM`.

## Firewall de Windows

Cuando Windows pregunte por Node.js, permite acceso al menos en redes privadas.

No es necesario desactivar completamente el firewall.

## Si la red del salón bloquea conexiones entre equipos

Plan B recomendado:

1. router propio;
2. hotspot local;
3. conectar profesor y alumnos a esa red;
4. repetir primero `/health`;
5. después ejecutar los clientes.

Tailscale puede usarse como contingencia adicional, pero no es requisito de esta fase.

## Criterio práctico de éxito

La red de clase está lista cuando:

```text
PC A     PC B     PC C
  │        │        │
  └────────┼────────┘
           ▼
     PC PROFESOR
           │
           ▼
 todos ven los mismos jugadores
```

y al cerrar una computadora su jugador desaparece de las demás sin refresh.
