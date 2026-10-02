# HackaTec Multiplayer Lab

Base educativa para construir colaborativamente un videojuego web 2D multijugador usando **TypeScript, Phaser, Socket.IO, Git, prompts y agentes de programación**.

## Estado

**Fase 1 — Presencia multijugador**

La base actual ya incluye:

- monorepo con npm workspaces;
- cliente Phaser;
- servidor Node + Express + Socket.IO;
- contratos compartidos;
- salas en memoria;
- jugadores estáticos sincronizados;
- entrada y salida en tiempo real;
- aislamiento entre salas;
- reconexión;
- tests, build y smoke test multicliente.

Todavía **no** incluye movimiento, disparos, vida, daño, score ni mapa jugable. Esas features quedan reservadas para la clase.

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

Prueba tres jugadores con tres pestañas:

```text
http://localhost:5173/?room=hackatec&name=Rafael
http://localhost:5173/?room=hackatec&name=Ana
http://localhost:5173/?room=hackatec&name=Luis
```

Todos deben ver los mismos jugadores.

Si cierras una pestaña, ese jugador debe desaparecer de las demás sin refrescar.

## Parámetros de entrada

Sala:

```text
?room=hackatec
```

Nombre:

```text
?name=Ana
```

Combinados:

```text
?room=hackatec&name=Ana
```

Si no indicas sala se usa:

```text
classroom
```

Si no indicas nombre, el servidor genera uno.

## PC del profesor — servidor central

```bash
npm run dev:server
```

El servidor escucha en:

```text
0.0.0.0:3001
```

Health check:

```text
http://localhost:3001/health
```

Respuesta:

```json
{
  "ok": true,
  "service": "hackatec-multiplayer-server"
}
```

## PC del alumno

Copia:

```text
apps/game/.env.example
```

como:

```text
apps/game/.env.local
```

y configura:

```env
VITE_SERVER_URL=http://IP_DEL_PROFESOR:3001
```

Después:

```bash
npm run dev:game
```

Abre, por ejemplo:

```text
http://localhost:5173/?room=hackatec&name=Ana
```

## Encontrar la IP del profesor en Windows

```powershell
ipconfig
```

Ejemplo:

```text
192.168.1.25
```

Desde otra computadora prueba primero:

```text
http://192.168.1.25:3001/health
```

o:

```powershell
Test-NetConnection 192.168.1.25 -Port 3001
```

Consulta [docs/NETWORKING.md](docs/NETWORKING.md) para el procedimiento completo.

## Scripts

```bash
npm run dev
npm run dev:server
npm run dev:game
npm run build
npm test
npm run check
```

## Arquitectura

```text
apps/
├── game/          Phaser + Socket.IO Client
└── server/        Express + Socket.IO

packages/
└── shared/        eventos y tipos compartidos
```

Flujo de presencia:

```text
cliente
  │
  └── room:join
         ↓
      servidor
         │
         ├── room:state     → cliente que entra
         └── player:joined  → resto de la sala

disconnect
    ↓
servidor
    ↓
player:left
```

## Seguridad de estado

El servidor decide:

- quién pertenece a una sala;
- el ID del jugador;
- su posición inicial;
- su color;
- cuándo entra;
- cuándo sale.

El cliente solo solicita entrar y renderiza el estado recibido.

## Validación

```bash
npm run check
```

El CI además:

1. arranca el servidor;
2. comprueba `/health`;
3. conecta múltiples clientes Socket.IO reales;
4. comprueba join;
5. comprueba snapshot;
6. comprueba `player:joined`;
7. comprueba aislamiento;
8. comprueba `player:left`.

## Lo que se construirá durante la clase

La base termina intencionalmente con jugadores estáticos:

```text
movimiento   ❌
disparos     ❌
vida/daño    ❌
score        ❌
mapa         ❌
```

Esas funcionalidades serán desarrolladas mediante ramas, prompts, agentes, Pull Requests e integración.
