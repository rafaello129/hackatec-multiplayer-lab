# Fase 4 — personalización y HUD

## Implementación publicada
- Perfiles por identificador local persistente con almacenamiento JSON del servidor; escrituras serializadas.
- Actualizaciones por Socket.IO con validación de username (3-16 caracteres alfanuméricos y guion bajo) y color hexadecimal.
- Carga de skins PNG/JPEG/WebP (límite 2 MB, máximo 512×512) mediante HTTP y exposición estática desde `/skins`.
- Editor de nombre, color y skin sobre el juego.
- Apariencia y username sincronizados como parte de `PlayerState`, con difusión a integrantes de la sala.
- Renderizado de skins y color de respaldo en `PlayerView`.
- Barra gráfica de salud, contador de eliminaciones/muertes y clasificación de ocho participantes.
- Conservación del movimiento, mapa y combate de fases anteriores.

## Advertencias
- No se ejecutó npm/build ni prueba en navegador: el acceso GitHub desde la terminal no resuelve DNS; cambios publicados vía conector.
- No se añadieron pruebas automatizadas, conforme a lo solicitado.
- Las partidas no persistirán al reiniciar el servidor: solo persisten los perfiles.
- Persistencia JSON válida para clase/demo, no apropiada para concurrencia multiinstancia.
- El identificador local del perfil es una referencia persistente, **no autenticación**: no utilizar el sistema para información sensible.
- Para producción, endurecer la validación de la carga de imágenes, añadir autenticación y almacenamiento robusto.
- `main` sigue intacta.

## Uso previsto
```bash
git fetch origin
git checkout integration/full-game
npm ci
npm run dev
```
En el panel lateral seleccionar el nombre, color o archivo de skin y pulsar Guardar perfil.

## Fase siguiente
Correcciones de integración, compilación, ejecución real y promoción final a `main`.
