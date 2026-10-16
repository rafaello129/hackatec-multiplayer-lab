# HackaTec Multiplayer Lab

Base educativa para construir colaborativamente un videojuego web 2D multijugador usando **TypeScript, Phaser, Socket.IO, Git, prompts y agentes de programación**.

Para la siguiente clase: [seis ejercicios independientes con funciones vacías e integración preparada](docs/CLASSROOM.md). Cada alumno trabaja en su propia carpeta.

## Estado

**Laboratorio jugable — lobby e invitaciones**

La base ya incluye:

- monorepo con npm workspaces;
- cliente Phaser;
- servidor Node + Express + Socket.IO;
- contratos compartidos;
- salas en memoria;
- lobby para crear o entrar a salas e invitar jugadores;
- movimiento, dash y jugadores sincronizados;
- armas, daño, bajas y respawn;
- mapas con paredes, trampas y cactus;
- perfiles, skins y clasificación;
- entrada y salida en tiempo real;
- aislamiento entre salas;
- reconexión;
- funcionamiento por LAN;
- tests, build y smoke test multicliente;
- CI para pushes y Pull Requests;
- guía de arquitectura;
- reglas para agentes;
- prompts de clase;
- flujo de contribución;
- plantillas de Issue y Pull Request;
- guía operativa del profesor.

> El desarrollo sigue siendo incremental: cada nueva función debe tener alcance y validación propios.

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

Levanta:

- servidor en `http://localhost:3001`;
- cliente Vite en `http://localhost:5173`.

Abre `http://localhost:5173/` para elegir nombre y sala. **Crear sala nueva** genera un código; **Entrar a la sala** crea la sala si está vacía o te une a sus jugadores. En la partida, **Invitar** permite copiar un enlace y **Volver al lobby** cierra tu conexión actual al navegar.

Las invitaciones contienen solo `?room=...`: cada invitado elige su propio nombre. Los enlaces anteriores con sala y nombre siguen entrando directamente. Para invitar a otro equipo por LAN, abre primero el cliente mediante la IP accesible del host y configura `VITE_SERVER_URL` según la sección de networking.

Prueba tres jugadores con enlaces directos:

```text
http://localhost:5173/?room=hackatec&name=Rafael
http://localhost:5173/?room=hackatec&name=Ana
http://localhost:5173/?room=hackatec&name=Luis
```

Todos deben ver los mismos jugadores. Al cerrar una pestaña, ese jugador desaparece de las demás sin refrescar.

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

El modelo de autoridad es:

```text
CLIENTE
solicita acciones
   ↓
SERVIDOR
valida y mantiene estado compartido
   ↓
CLIENTES
renderizan el estado aceptado
```

## Flujo de trabajo de clase

```text
ISSUE
  ↓
ANÁLISIS
  ↓
PROMPT
  ↓
AGENTE
  ↓
BRANCH
  ↓
IMPLEMENTACIÓN
  ↓
npm run check
  ↓
PULL REQUEST
  ↓
CI + REVIEW
  ↓
MERGE
```

No trabajar directamente sobre `main`.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Operación de clase](docs/CLASSROOM.md)
- [Networking LAN](docs/NETWORKING.md)
- [Prompts para agentes](docs/PROMPTS.md)
- [Cómo contribuir](CONTRIBUTING.md)
- [Reglas para agentes](AGENTS.md)

## CI

Cada Pull Request hacia `main` ejecuta:

1. `npm ci`;
2. tests y build;
3. servidor;
4. `/health`;
5. smoke test con múltiples clientes Socket.IO.

Un PR con CI fallando no está listo para merge.

## Próximas funciones

```text
reconexión con continuidad de partida
rondas y resultados
tutorial y feedback de combate
controles táctiles
equipos y espectadores
herramientas del profesor
```

Se desarrollarán en ramas separadas mediante Issues, prompts, agentes y Pull Requests.
