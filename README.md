# HackaTec Multiplayer Lab

Base educativa para construir colaborativamente un videojuego web 2D multijugador usando **TypeScript, Phaser, Socket.IO, Git, prompts y agentes de programación**.

## Estado

**Fase 0 — Fundación técnica**

La base actual incluye:

- monorepo con npm workspaces;
- cliente Phaser;
- servidor Node + Express + Socket.IO;
- contratos compartidos;
- `GET /health`;
- conexión Socket.IO;
- configuración para localhost o una LAN;
- tests y build desde la raíz.

Todavía **no** incluye jugadores, movimiento, disparos, vida, score ni mapa. Esas funcionalidades se agregarán después y durante la clase.

## Requisitos

- Node.js 22 o superior
- npm
- Git

## Instalación

```bash
git clone https://github.com/rafaello129/hackatec-multiplayer-lab.git
cd hackatec-multiplayer-lab
npm ci
```

## Desarrollo local completo

```bash
npm run dev
```

Esto levanta:

- servidor en `http://localhost:3001`;
- cliente Vite en `http://localhost:5173`.

## Solo servidor — PC del profesor

```bash
npm run dev:server
```

El servidor escucha por defecto en:

```text
0.0.0.0:3001
```

Health check:

```text
http://localhost:3001/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "service": "hackatec-multiplayer-server"
}
```

## Solo cliente — PC del alumno

Copia:

```text
apps/game/.env.example
```

como:

```text
apps/game/.env.local
```

y cambia la URL:

```env
VITE_SERVER_URL=http://IP_DEL_PROFESOR:3001
```

Después:

```bash
npm run dev:game
```

## Encontrar la IP del profesor en Windows

```powershell
ipconfig
```

Busca la dirección IPv4 de la interfaz conectada al mismo Wi-Fi o LAN que los alumnos.

Ejemplo:

```text
192.168.1.25
```

Entonces el alumno puede probar primero:

```text
http://192.168.1.25:3001/health
```

y después configurar:

```env
VITE_SERVER_URL=http://192.168.1.25:3001
```

## Probar el puerto desde otra PC

```powershell
Test-NetConnection 192.168.1.25 -Port 3001
```

Si Windows muestra un aviso de Firewall para Node.js, permite la conexión en redes privadas.

Consulta [docs/NETWORKING.md](docs/NETWORKING.md) para el flujo completo de red.

## Scripts

```bash
npm run dev
npm run dev:server
npm run dev:game
npm run build
npm test
npm run check
```

## Estructura

```text
apps/
├── game/
└── server/

packages/
└── shared/
```

- `apps/game`: cliente Phaser.
- `apps/server`: servidor Express + Socket.IO.
- `packages/shared`: tipos y eventos compartidos.

## Variables de entorno

Servidor:

```env
HOST=0.0.0.0
PORT=3001
CORS_ORIGIN=*
```

Cliente:

```env
VITE_SERVER_URL=http://localhost:3001
```

Los archivos `.env` reales no se versionan.

## Validación

```bash
npm run check
```

Ejecuta tests y build de todos los workspaces.

## Qué sigue

La Fase 1 añadirá:

```text
join room
   ↓
PlayerState
   ↓
estado inicial
   ↓
jugadores visibles
   ↓
player:joined / player:left
```

Los jugadores seguirán estáticos. El movimiento será una feature para construir durante la clase.
