# Networking — HackaTec Multiplayer Lab

## Objetivo

Durante la clase, la PC del profesor ejecutará el servidor central y las PCs de los alumnos ejecutarán sus propios clientes.

```text
PC Profesor
Node + Socket.IO
0.0.0.0:3001
      │
      ├──────── PC Alumno A
      ├──────── PC Alumno B
      └──────── PC Alumno C
```

## 1. Profesor: levantar servidor

```bash
npm ci
npm run dev:server
```

## 2. Profesor: encontrar IPv4

En Windows:

```powershell
ipconfig
```

Usa la IPv4 de la interfaz conectada a la red del salón.

Ejemplo:

```text
192.168.1.25
```

## 3. Alumno: comprobar conectividad HTTP

En un navegador:

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

También puede probarse desde PowerShell:

```powershell
Test-NetConnection 192.168.1.25 -Port 3001
```

## 4. Alumno: configurar cliente

Crea:

```text
apps/game/.env.local
```

con:

```env
VITE_SERVER_URL=http://192.168.1.25:3001
```

Luego:

```bash
npm run dev:game
```

## 5. Resultado esperado

La pantalla Phaser debe mostrar:

```text
Servidor: conectado
```

## Diagnóstico

### /health no abre

Revisar, en este orden:

1. servidor del profesor sigue ejecutándose;
2. IP correcta;
3. alumno y profesor están en la misma red;
4. puerto 3001;
5. Firewall de Windows;
6. la red no tiene aislamiento entre clientes.

### /health funciona pero Phaser dice desconectado

Revisar:

1. `VITE_SERVER_URL`;
2. reiniciar Vite después de cambiar `.env.local`;
3. consola del navegador;
4. logs del servidor;
5. CORS.

### La red del salón bloquea conexiones

Plan B recomendado:

1. router propio o hotspot local;
2. conectar profesor y alumnos a esa misma red;
3. repetir la prueba `/health`.

Tailscale puede usarse como contingencia posterior, pero no es requisito de la Fase 0.
