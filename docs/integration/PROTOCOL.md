# Protocol and authority — Phase 1

## Active socket events

| Event | Direction | Semantics |
|---|---|---|
| `connection:ready` | server → connecting client | Contains the server socket ID |
| `room:join` | client → server | Object with roomId and optional playerName |
| `room:state` | server → joining client | Room snapshot and current player's socket ID |
| `room:error` | server → one client | Invalid room or full room, with code and message |
| `player:joined` | server → other members | New player state |
| `player:left` | server → remaining members | Departed player ID |

Socket handlers must validate unknown external data before accessing properties or mutating membership. `RoomManager` validates room syntax and capacity. Socket IDs are connection identities, not persistent profiles.

## Reserved future events (NOT ACTIVE)

`player:input`, `game:snapshot`, `player:shoot`, `player:hit`, `player:respawn`, `profile:appearance:set`, `profile:username:set`.

## Authority boundary

Client sends intention, server validates and decides, clients render accepted snapshots. Do not accept authoritative position, HP, immunity or projectile impact from a client. Simulation will be per-room with deterministic lifecycle and injected clock; Phase 1 intentionally does not start a simulation tick.
