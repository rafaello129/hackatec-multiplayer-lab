# Arquitectura — HackaTec Multiplayer Lab

## Vista general

```text
apps/
├── game/       Phaser + Socket.IO Client
└── server/     Express + Socket.IO

packages/
└── shared/     eventos y tipos compartidos
```

## Responsabilidades

### `apps/game`

Renderiza el juego, mantiene la representación visual local, captura input y consume eventos del servidor.

Rutas relevantes:

```text
apps/game/src/game/
apps/game/src/network/
apps/game/src/state/PlayerRegistry.ts
```

### `apps/server`

Mantiene el estado compartido de la sesión y la lógica autoritativa.

Rutas relevantes:

```text
apps/server/src/rooms/RoomManager.ts
apps/server/src/socket/index.ts
apps/server/src/game/
```

### `packages/shared`

Define el idioma común entre cliente y servidor.

```text
packages/shared/src/events.ts
packages/shared/src/types.ts
```

Los eventos y tipos de red no deben duplicarse en cada aplicación.

## Flujo actual

```text
GAME CLIENT
     │
     │ room:join
     ▼
SERVER
     │
     ├── RoomManager
     ├── Player state
     │
     ├── room:state      → jugador que entra
     └── player:joined   → resto de la sala

disconnect
     │
     ▼
SERVER
     │
     └── player:left     → resto de la sala
```

## Frontera de autoridad

```text
CLIENTE
solicita acciones
      │
      ▼
SERVIDOR
valida y mantiene estado compartido
      │
      ▼
CLIENTES
renderizan el estado aceptado
```

Para las features de clase, preferir este modelo:

```text
cliente → intención
servidor → decisión
clientes → representación
```

## Regla de integración

Si una feature necesita un evento nuevo:

1. definir contrato en `packages/shared`;
2. implementar manejo en servidor;
3. consumirlo en cliente;
4. añadir pruebas;
5. ejecutar `npm run check`.

## Estado deliberadamente incompleto

La arquitectura está preparada para crecer, pero todavía no contiene:

- movimiento sincronizado;
- proyectiles;
- daño;
- respawn;
- kills;
- obstáculos jugables;
- scoreboard funcional.

Eso es material de clase.
