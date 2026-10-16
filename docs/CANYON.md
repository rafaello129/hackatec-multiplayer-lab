# Cañón Rojo — nivel ampliado

Mundo de **2304 × 1536**, aproximadamente 6,2 veces la superficie jugable anterior (1024 × 560). La ventana de combate conserva 1024 × 560: una cámara sigue a la nave mientras la interfaz permanece fija. El minimapa muestra terreno, cactus, vallas, posición propia y área visible; no revela enemigos.

## Diseño de nivel

- **Paso Norte:** ruta exterior amplia para cambiar de flanco, con coberturas al sur.
- **Garganta Oeste:** mesetas grandes que rompen las líneas de tiro y pequeñas coberturas en los enlaces al centro.
- **Cruce Seco:** espacio central con coberturas separadas y salidas hacia ambos flancos.
- **Cantera Este:** rocas de distintas proporciones y accesos desplazados respecto al oeste.
- **Jardín de Espinas:** paso sur con cactus agrupados junto a las rocas y una ruta exterior para rodearlos.

Ocho senderos conectan las zonas. El circuito exterior permite flanquear sin atravesar siempre el centro; los enlaces interiores acortan el recorrido a cambio de mayor exposición. Se colocan 18 rocas sólidas, 30 cactus en diez grupos y 6 trampas rodeables. La semilla introduce variaciones pequeñas en las mesetas, manteniendo la estructura.

Las 32 apariciones alternan lados del perímetro, con al menos 48 píxeles de separación respecto al borde de los obstáculos. Todos los puntos tienen una ruta al centro que evita muros y peligros. Esta validación comprueba transitabilidad, no sustituye pruebas de equilibrio con grupos de jugadores.

## Implementación y verificación

- El servidor usa las dimensiones reales del mapa para movimiento y proyectiles, sin límites dependientes de la interfaz.
- Zonas y senderos se transmiten en el contrato compartido del mapa.
- El disparo convierte el cursor mediante la cámara del mundo; la cámara recupera su objetivo después de reconectar o recargar.
- `npm run check`: **57 pruebas aprobadas** y compilación correcta; persiste el aviso de tamaño del bundle de Phaser.
- Pruebas sobre 100 semillas: límites, separaciones, cantidades y seguridad de apariciones. Búsqueda de rutas desde las 32 apariciones en todas las variantes geométricas.
- Pruebas adicionales: movimiento y disparos más allá de los límites anteriores, con colisión en el borde del mundo.
- Smoke multicliente y de reconexión aprobados.
- Chrome: recorrido hasta x=1126,5 / y=870, disparo hacia el cursor con cámara desplazada, recuperación de posición al recargar y dos clientes sin errores JavaScript. Se corrigió durante esta prueba una carrera entre snapshots de combate y la identificación del jugador que impedía el seguimiento de cámara.

Evidencia: `output/playwright/large-level/verify.cjs`, `two-players.png` y `overview.svg`. El plano se regenera con `node output/playwright/large-level/overview.mjs` después de compilar el servidor.

## Arte

La roca de `apps/game/public/assets/sprites/canyon-rock.png` fue generada con la herramienta integrada `image_gen`, fondo transparente. Los cactus conservan el atlas anterior. Este mapa sustituye las vallas de madera/piedra por roca y los cactus con maceta por cactus silvestres; los assets originales siguen disponibles.

Prompt: “A single production-ready 2D top-down game sprite: wide horizontal desert canyon sandstone mesa, viewed from directly overhead with a small south-facing rock cliff edge. Aspect ratio of object 2.2:1. Detailed warm rust-red and terracotta stratified rock, irregular chipped stepped perimeter, small natural fissures across sandy plateau, layers of exposed stone on bottom side. Crisp retro pixel art at about 200x90 pixel detail, matching colorful outlined green cactus game sprites. Rock should fill an approximately rectangular collision footprint with only slightly irregular edges, not round, NOT a wooden crate, NOT a frame, NOT a building, no grid, no labels, no cactus, no plants. SINGLE isolated rock formation centered, generous fully transparent margin, no scene background, no colored glow, no haze, no separate floating stones. Dark narrow outline and sunlit upper-left edges. Fully opaque object and fully transparent empty background.”


## Visibilidad de los cactus

Se añadieron cuatro grupos interiores: los cactus anteriores estaban concentrados en el perímetro y desaparecían de la vista al llegar al cruce. Una prueba verifica que el centro y sus cuatro accesos muestran al menos un grupo completo dentro de la cámara. Se mantienen las pruebas de separación, seguridad y conectividad.

Revisión visual en Chrome: recorrido hasta x=1117,25 / y=796, cactus y vallas visibles, disparo, recarga y dos clientes sin errores JavaScript. Smoke multicliente y reconexión aprobados. Evidencia: output/playwright/large-level/verify-cactus.cjs y cactus-inspect.png.
