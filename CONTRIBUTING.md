# Contribuir — HackaTec Multiplayer Lab

## Regla principal

No trabajar directamente sobre `main`.

## 1. Actualizar base

```bash
git switch main
git pull
```

## 2. Crear una rama

Usa una rama relacionada con tu Issue:

```bash
git switch -c feature/nombre-feature
```

Ejemplos:

```text
feature/player-movement
feature/shooting
feature/health
feature/map
feature/scoreboard
feature/respawn-kills
```

## 3. Antes de programar

1. Lee el Issue.
2. Lee `AGENTS.md`.
3. Revisa `docs/ARCHITECTURE.md`.
4. Pide al agente un análisis y plan corto antes de implementar.

## 4. Durante el trabajo

```bash
git status
git diff
```

Haz cambios pequeños y dentro del alcance.

## 5. Validar

```bash
npm test
npm run build
```

Antes de abrir PR:

```bash
npm run check
```

## 6. Commit

```bash
git add .
git commit -m "feat: descripción corta"
```

## 7. Push

```bash
git push -u origin feature/nombre-feature
```

## 8. Pull Request

Abre un PR hacia `main` y completa la plantilla.

Un PR no está listo solo porque “funciona en mi PC”. Debe cumplir el Issue, pasar CI, compilar y ser probado manualmente.

## Servidor central del profesor

El servidor del profesor ejecuta la versión integrada de `main`.

Si tu feature modifica servidor o contratos, durante desarrollo usa tu propia copia:

```bash
npm run dev
```

con:

```env
VITE_SERVER_URL=http://localhost:3001
```

Después del merge, el profesor actualizará y reiniciará el servidor central para la prueba LAN.
