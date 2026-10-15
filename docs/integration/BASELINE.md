# Phase 1 baseline

- Repository: `rafaello129/hackatec-multiplayer-lab`
- Starting branch: `main`
- Baseline commit: `83a1a9c6b7f9131934b9b824536cc834da9599a6`
- Work branch: `integration/full-game`
- GitHub comparisons show functional branches for movement, map, weapons, and profiles.
- Baseline scripts: `npm ci`, `npm test`, `npm run build`, `npm run check`.
- Required runtime: Node.js >=22.
- **Execution status:** Not run in an isolated checkout. The current working environment cannot resolve github.com via git, so no build/test success is asserted.
- Source review: client and server use shared `@hackatec/shared` contracts; server defaults to port 3001, game to port 5173.
- Phase 1 changes must preserve room presence and must not enable movement or combat.
