# Operación de clase — HackaTec Multiplayer Lab

## Antes de la clase — profesor

```bash
git clone https://github.com/rafaello129/hackatec-multiplayer-lab.git
cd hackatec-multiplayer-lab
npm ci
npm run check
npm run dev:server
```

En Windows:

```powershell
ipconfig
```

Anota la IPv4 de la interfaz usada por el aula.

Desde otra PC:

```powershell
Test-NetConnection IP_PROFESOR -Port 3001
```

y abre:

```text
http://IP_PROFESOR:3001/health
```

Consulta `docs/NETWORKING.md` si falla.

## Inicio — alumnos

```bash
git clone https://github.com/rafaello129/hackatec-multiplayer-lab.git
cd hackatec-multiplayer-lab
npm ci
```

Crear:

```text
apps/game/.env.local
```

con:

```env
VITE_SERVER_URL=http://IP_PROFESOR:3001
```

Después:

```bash
npm run dev:game
```

Todos deben comprobar antes de comenzar:

```text
CONNECTED
misma sala
todos los nombres visibles
```

## Flujo de trabajo de cada equipo

```text
Issue
  ↓
leer AGENTS.md
  ↓
prompt de análisis
  ↓
crear branch
  ↓
agente implementa
  ↓
npm run check
  ↓
git diff
  ↓
commit + push
  ↓
Pull Request
  ↓
CI + review
  ↓
merge
```

## Primera ronda sugerida

```text
Equipo A → Movimiento
Equipo B → Disparos
Equipo C → Health
Equipo D → Mapa
Equipo E → HUD base
```

Respawn + kills se integra después de Shooting + Health.

## Equipos que modifican servidor

No prueben su branch contra el servidor central de `main`.

Durante desarrollo:

```bash
npm run dev
```

y:

```env
VITE_SERVER_URL=http://localhost:3001
```

Después del merge:

```text
profesor → git pull
         → reinicia servidor central
         → prueba LAN conjunta
```

## Forks vs colaboradores

### Recomendado para clase abierta: fork + PR

```text
fork
 ↓
clone del fork
 ↓
feature branch
 ↓
push
 ↓
PR al repositorio principal
```

### Alternativa: colaboradores

Si todos fueron añadidos previamente:

```text
clone
 ↓
feature branch
 ↓
push
 ↓
PR
```

## Regla de merge

Antes de integrar:

```text
Issue cumplido
+
git diff revisado
+
tests
+
build
+
CI
+
prueba manual
```

## Plan B de red

Orden:

1. Wi-Fi/LAN del aula;
2. router propio;
3. hotspot;
4. Tailscale;
5. varias pestañas en una sola PC.

La opción 5 permite continuar enseñando Git, prompts y agentes aunque falle la red física.
