# Cuentas y sesiones

## Requisitos

- Node.js 22 o superior.
- SQLite integrado en Node.js.
- Argon2id para almacenar contraseñas; nunca se guardan contraseñas en texto plano.
- Las cuentas nuevas comienzan sin importar los perfiles del antiguo archivo JSON.

## Desarrollo local

El servidor crea la base de datos automáticamente. Por defecto, se guarda en:

`apps/server/storage/accounts.sqlite`

Puedes cambiar la ruta con `DB_PATH`. La base de datos contiene:

- `accounts`: identificador permanente, nombre de usuario único sin distinguir mayúsculas/minúsculas y hash Argon2id;
- `profiles`: apariencia asociada a la cuenta;
- `sessions`: hashes SHA-256 de tokens aleatorios, con vencimiento;
- `progression`: XP dentro del nivel, nivel actual y XP total acumulada;
- `skins`: estructura para metadatos de skins vinculados a una cuenta.

El archivo anterior `storage/profiles.json` no se importa ni se elimina automáticamente.

## Crear cuenta

- Nombre: 3–16 caracteres ASCII, empieza con una letra y continúa con letras, números o guion bajo.
- Contraseña: 8–128 caracteres.
- Los nombres se comparan sin distinguir mayúsculas/minúsculas.
- El nombre de usuario se puede cambiar desde la personalización del perfil; el identificador permanente de la cuenta no cambia.

Rutas HTTP:

- `POST /api/auth/register` — crea la cuenta e inicia sesión.
- `POST /api/auth/login` — verifica la contraseña y crea una sesión.
- `GET /api/auth/session` y `GET /api/auth/me` — recuperan la sesión actual.
- `POST /api/auth/logout` — revoca la sesión.

El primer registro exitoso del nombre `Gueta` (sin distinguir mayúsculas/minúsculas) obtiene automáticamente el estado de propietario en el servidor. No se necesita una clave adicional ni configuración especial del host. La base de datos impide registros duplicados y el propietario no puede cambiar su nombre; otras cuentas tampoco pueden apropiarse de `Gueta` mediante un cambio de nombre. La autorización de contenido exclusivo se basa en el indicador de propietario guardado en SQLite, no en datos enviados por el cliente. **Quien registre `Gueta` primero obtiene el privilegio**, así que el sistema no verifica la identidad personal de quien lo registra.

El token de sesión se entrega mediante una cookie `HttpOnly`; el navegador no necesita leerlo desde JavaScript. La sesión dura siete días. El servidor vuelve a validar la sesión al establecer la conexión Socket.IO, y una conexión sin cuenta no puede entrar a una sala.

Los errores de inicio de sesión no distinguen entre usuario inexistente y contraseña incorrecta. Los intentos fallidos se limitan temporalmente por dirección IP.

## Progresión vinculada a la cuenta

La progresión se consulta en la base de datos por el identificador permanente de cuenta. El juego también envía un snapshot al entrar a la sala y después de adjudicar XP. Las recompensas se calculan al cerrar la ronda a partir de bajas, asistencias, zombies eliminados, colocación y fases de tormenta sobrevividas. La elegibilidad por actividad se mide con señales de juego recibidas por el servidor; el cliente no puede enviar una cantidad de XP.

La fórmula de XP requerida para el siguiente nivel es `round(100 × nivel^1.5)`. La columna `total_xp` se añadió mediante una migración compatible al abrir una base de datos antigua.

## CORS y despliegue

En desarrollo, `CORS_ORIGIN=*` es práctico para trabajar en LAN. **No uses ese valor en producción.** Define `CORS_ORIGIN` como una lista separada por comas con los orígenes exactos del cliente, por ejemplo:

```env
NODE_ENV=production
CORS_ORIGIN=https://juego.ejemplo.com
DB_PATH=storage/accounts.sqlite
```

En producción la cookie usa `Secure; SameSite=None` para permitir un cliente y servidor alojados en orígenes distintos. Las peticiones que cambian sesión o suben skins deben venir de un origen permitido.

No publiques ni compartas `accounts.sqlite`: contiene datos de cuentas y hashes de contraseñas. Haz copias de seguridad con el servidor detenido o usando un procedimiento de respaldo consistente de SQLite.
