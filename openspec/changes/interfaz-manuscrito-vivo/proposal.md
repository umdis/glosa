## Why

El propietario revisó la interfaz (2026-10-27): le gustan los colores (vitela, tinta, carmín) y la letra (Alegreya y Alegreya Sans), pero «parece una página de los años 2000, con muy poca UX/UI y sin distinción ni originalidad». La Demo pesa el 25 % de la rúbrica y lo primero que ve un jurado es esta interfaz.

El diagnóstico sobre el código:
- Todo es texto sobre un fondo plano. No hay superficies ni profundidad, y la jerarquía depende solo del tamaño de la letra.
- Los controles son casi los del navegador.
- La portada no enseña el producto.
- Lo que hacía distinta a Glosa en D12 (las glosas en el margen unidas a su frase por un trazo) nunca se construyó: el margen exterior está vacío.

## What Changes

Se conserva la dirección D12, «el manuscrito vivo», con la paleta y las fuentes actuales, y se ejecuta como un producto moderno. Se cambian todas las pantallas a fondo, por decisión del propietario.

- **Sistema visual**: tokens de superficie, sombra, radio, espaciado y movimiento, y componentes sobre elementos nativos (botón, campo, chip, interruptor, insignia). La marca pasa a ser «¶ Glosa».
  - *Rúbrica:* Demo.
- **Fotogramas reales**: el servidor extrae con ffmpeg el cuadro de un momento y lo guarda en caché. Se usa para el póster de cada video, las citas, lo que salió en pantalla y el espécimen de la portada. Se puede apagar con `SHOW_FRAMES`.
  - *Rúbrica:* Demo e Impacto, porque cada nota al pie lleva su imagen.
- **Glosas en el margen**: lo que salió en pantalla y los pasajes dichos se muestran en el margen del video, junto a su frase. En «Preguntar», las citas son glosas unidas a su afirmación por un trazo que se dibuja.
  - *Rúbrica:* Demo y Profundidad técnica, porque hace visible la verificación.
- **Pantallas**:
  - Portada con un espécimen vivo, cifras reales y la colección con pósteres.
  - Video con hilo de progreso, «Volver a lo que suena» y búsqueda dentro del video.
  - Búsqueda con filtro por video.
  - Índice bíblico por testamento.
  - Editor con zona de subida.
  - Transiciones entre páginas.

## Capabilities

### New Capabilities
- `interfaz-lectura`: el sistema visual y el comportamiento de las pantallas de lectura (portada, video, búsqueda, preguntar, índice, editor).
- `fotogramas`: extracción, caché y publicación de cuadros del video.

### Modified Capabilities
(ninguna: las capacidades de `nucleo-glosa` siguen igual; esto cambia cómo se presentan)

## No objetivos

- No se cambian la paleta ni las fuentes.
- No hay lógica nueva de búsqueda, del agente ni de verificación.
- No hay reproductor propio: se usa `<video>` nativo, que ya es accesible.
- No hay modo de alto contraste propio más allá del forzado del sistema.
- No hay fotogramas por cada fila de la concordancia: serían demasiados cuadros por búsqueda.

## Impact

- Código: `src/lib/estilos/`, todas las rutas de `src/routes/`, `src/lib/componentes/`, `src/lib/server/medios/ffmpeg.ts`, `src/lib/server/biblia/indice.ts`, `src/lib/server/config.ts` y `src/env.ts`.
- Una variable nueva: `SHOW_FRAMES` (opcional, activa por defecto).
- Disco: los fotogramas se guardan junto a los medios de cada video y se borran con él.
- Privacidad: los fotogramas pueden mostrar a la congregación. Solo se sirven de videos públicos y el propietario puede apagarlos.
