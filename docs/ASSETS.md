# Sprites de la arena

Los cinco PNG suministrados se conservan en `apps/game/public/assets/sprites/source/`.

- Jugador: `source/ship.png`, original sin modificaciones. El borde conserva el color del perfil; las skins personalizadas siguen disponibles.
- Cactus pequeños: cactus con maceta. Medianos y grandes: cactus verde, escalado sin alterar la proporción. El contorno tenue indica el área de daño autoritativa.
- Muros: vallas de madera y piedra, elegidas de forma determinista por ID. Los muros verticales rotan el sprite.
- Trampas: postes con cuerda sobre el área violeta de inmovilización.

`arena.png` es un atlas transparente de tres columnas y dos filas preparado con la herramienta integrada de imágenes a partir de los adjuntos. Se conservan los originales; el atlas es una adaptación visual. Sus celdas son nave, cactus con maceta, cactus verde, cuerda, valla y muro de piedra. La nave del atlas no sustituye al PNG original del jugador.

La escena carga las imágenes antes de crear jugadores y obstáculos, tanto desde el lobby como con enlaces directos. Los frames se delimitan por alfa y usan filtrado NEAREST. Los sprites de obstáculos se destruyen al reemplazar el mapa o cerrar la escena. Las colisiones, daño y reglas siguen en el servidor.

## Preparación del atlas

Herramienta: `image_gen`, modo integrado, con los cinco adjuntos como referencia y `transparent_background: true`.

Prompt inicial: preparar un atlas de seis sprites en una cuadrícula de tres columnas y dos filas; conservar los diseños pixel art, aislar nave, ambos cactus, postes con cuerda, valla roja y muro de piedra, sin etiquetas ni líneas de cuadrícula.

Prompt final de ajuste: “Correct this sprite atlas for production use. Remove ALL glow, bloom, colored haze, soft shadows and dark background around the six sprites, making every pixel outside their hard pixel-art outlines fully transparent alpha=0. Preserve the six sprites themselves and their positions EXACTLY, same 1536x1024 canvas and 3-column 2-row grid. Completely opaque solid sprites, completely transparent empty space. No semitransparent glow. Do not add any shading or backdrop. Keep sharp pixel outlines and all shapes/colors.”

## Verificación

`npm run check` ejecuta las 53 pruebas y la compilación. La comprobación visual con dos navegadores está en `output/playwright/assets/verify.cjs`, con captura en `two-players.png`.
