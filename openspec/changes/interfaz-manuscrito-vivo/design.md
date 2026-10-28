## Context

La interfaz actual sigue la paleta y la tipografía de D12 (`nucleo-glosa/design.md`), pero se quedó en texto plano. Pantallas: portada (`/`), video (`/videos/[id]`), búsqueda (`/search`), preguntar (`/ask`), índice bíblico (`/passages`) y editor (`/admin`). Stack: SvelteKit 3, Svelte 5 y CSS propio con `@fontsource`, sin framework de estilos. Quedan 8 días para la entrega.

## Goals / Non-Goals

**Goals:** que la interfaz se reconozca a primera vista como Glosa y no como una plantilla; que la verificación se vea; que nada empeore en accesibilidad.

**Non-Goals:** ver `proposal.md`.

## Decisions

### I1. Un solo gesto memorable: la glosa al margen
Toda la audacia se gasta en una cosa: **la nota en el margen unida a su frase por un trazo fino**. Aparece en la portada (espécimen), en el video (lo que salió en pantalla y los pasajes) y en «Preguntar» (las citas). Todo lo demás es sobrio.
- Se descartó repartir efectos por todas partes: tarjetas que se elevan en cada lista y entradas que aparecen deslizándose. Eso se lee como plantilla.
- Las tarjetas se reservan para objetos de verdad: un video, una cita, una referencia. No sirven para trocear texto.

### I2. Tokens
- Superficies: `--fondo` (vitela), `--papel` y `--papel-alto`. Sombras tintadas con la tinta, nunca gris neutro.
- Radios jerárquicos: 6 px en los controles, 12 px en las tarjetas y 20 px en el póster grande.
- Espaciado en escala de 4.
- Movimiento: `--dur-corta` 160 ms, `--dur-media` 320 ms y una curva de salida suave.
- El carmín sigue reservado para lo que se puede verificar y saltar. La navegación activa va en tinta.
- `contraste.spec.ts` mide los tokens: texto ≥ 4,5:1 y bordes de control ≥ 3:1, en ambos temas.

### I3. Componentes como clases sobre elementos nativos
Viven en `componentes.css`: `.boton` (primario, secundario y fantasma), `.campo`, `.chip`, `.insignia`, `.tarjeta` e `.interruptor`. El interruptor es un `input type=checkbox` con `role="switch"`.
- Se descartaron los componentes Svelte envoltorio para botones y campos: añaden capas, y la semántica nativa ya es la correcta.
- Los componentes Svelte se reservan para piezas con lógica: `Fotograma.svelte` (la imagen con su marcador tipográfico de respaldo). La glosa con hilo es una clase CSS (`.glosa`) porque no tiene lógica.

### I4. Fotogramas
- La ruta `GET /videos/[id]/fotograma/[segundo]?w=320|640` responde un JPEG.
  - El segundo se ajusta a `[0, duración − 1]`.
  - Si el video no es público, o `SHOW_FRAMES` está apagado, responde 404.
- La caché vive en `<medios>/<id>/fotogramas/<s>-<w>.jpg`. Se escribe en un archivo temporal y luego se renombra, para no servir nunca un JPEG a medias. Las peticiones simultáneas por el mismo cuadro comparten una sola promesa.
- `extraerFotograma` usa `-ss` antes de `-i` (salto rápido al fotograma clave), `-frames:v 1` y `scale=W:-2`. Se eligió JPEG porque ffmpeg-static siempre trae mjpeg y libwebp no siempre.
- El póster es el cuadro en `min(60 s, 10 % de la duración)`, porque el primer segundo suele ser negro.
- `Fotograma.svelte` fija `width` y `height` (16:9), usa `loading="lazy"` y `alt=""` porque el título va al lado. Si la imagen falla o está apagada, muestra el folio grande sobre papel.

### I5. Página de video
- Pistas de la cuadrícula según el ancho:
  - **Desde 90 rem:** cuatro pistas: `folio | texto | glosas | lámina`. La lámina, fija arriba, lleva el video y el panel «En este video».
  - **Entre 74 y 90 rem:** tres pistas: `folio | texto | lámina`. Las glosas van dentro del texto, bajo su fragmento.
  - **Por debajo:** una sola columna, con el video arriba.
- El hilo de progreso es una línea vertical en la pista del folio. Su parte llena es la proporción del video ya reproducida, y es decorativo (`aria-hidden`).
- «Volver a lo que suena» aparece cuando la persona se alejó del fragmento actual con el seguimiento activo. Es un botón real, alcanzable con teclado.
- La búsqueda dentro del video funciona en el navegador sobre los fragmentos cargados. Recorre las coincidencias con «siguiente/anterior» y anuncia «n de m» en `aria-live`.

### I6. «Preguntar»
- Las citas son glosas. En pantallas anchas van en el margen, y un trazo SVG (`Glosa.svelte`) une la afirmación con cada tarjeta y se dibuja una vez al aparecer. En pantallas estrechas se apilan con un filete.
- La carga se muestra con un esqueleto estático y una sola animación indeterminada, más el texto real que ya existe («about half a minute»). No hay pasos simulados.

### I7. Transiciones
`onNavigate` con `document.startViewTransition` donde exista. El póster de un video comparte `view-transition-name` con el reproductor. Con `prefers-reduced-motion: reduce` no hay transición.

## Risks / Trade-offs

- [Generar un fotograma tarda ~0,3-1 s en frío] → Hay caché en disco, carga diferida y solo dos anchos. El póster y las citas de la demo quedan calientes antes de grabar.
- [Los fotogramas muestran caras de la congregación] → Solo se sirven de videos públicos, se apagan con `SHOW_FRAMES=false` y el video de la demo ya se difumina.
- [Ocho días para todas las pantallas] → El orden es primero el sistema y los fotogramas, luego portada y video, después preguntar y búsqueda, y al final índice y editor, con un commit por bloque. La ruta de la demo queda lista primero.
- [Una regresión de accesibilidad] → Se repite el recorrido con teclado de la tarea 3.6, se ejecuta la prueba de contraste y se revisan el reflujo a 320 px y el movimiento reducido.
