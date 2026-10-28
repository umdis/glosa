## 1. Sistema visual y fotogramas

- [x] 1.1 ★ Tokens en `base.css` (superficies, sombras tintadas, radios, espaciado, movimiento) en ambos temas
- [x] 1.2 ★ `componentes.css`: botón, campo, chip, insignia, tarjeta, interruptor; retirar los `:global` del layout
- [x] 1.3 ★ Prueba `contraste.spec.ts` de los tokens en ambos temas
- [x] 1.4 ★ `extraerFotograma` en `ffmpeg.ts` y ruta `/videos/[id]/fotograma/[segundo]` con caché, deduplicación y `SHOW_FRAMES`, más sus pruebas
- [x] 1.5 ★ Componente `Fotograma.svelte` (con marcador de respaldo) y la glosa con hilo (clase `.glosa`, ver notas)

## 2. Ruta de la demo

- [x] 2.1 ★ Cabecera: fija, marca «¶ Glosa», atajo `/`, navegación en píldoras y transiciones entre páginas
- [x] 2.2 ★ Portada: espécimen vivo, cifras, colección con pósteres y «Cómo funciona»
- [x] 2.3 ★ Video: pistas, glosas al margen (`pasajesDeVideo`), hilo de progreso, interruptor y «Volver a lo que suena»
- [x] 2.4 ★ Video: buscar dentro del video y panel «En este video»
- [x] 2.5 ★ Preguntar: compositor, carga honesta, citas como glosas con trazo y fotograma; panel del estudio
- [x] 2.6 ★ Búsqueda: encabezado con filtro por video, grupos con póster y «Shown on screen» con fotograma

## 3. Resto de pantallas

- [x] 3.1 Índice bíblico por testamento, con cuadrícula de libros y referencias en tarjeta
- [x] 3.2 Editor: acceso, zona de subida y lista de videos con estado

## 4. Verificación

- [x] 4.1 ★ `npm run check`, `npm run lint` y `npm test` en verde
- [x] 4.2 ★ Capturas a 1440 y 1024 px y reflujo a 320 px (iframe), en claro y oscuro, comparadas con el antes
- [x] 4.3 ★ Recorrido con teclado real y comprobación con movimiento reducido
- [x] 4.4 Fotogramas: frío y caché, `SHOW_FRAMES=false` y 404 de un video no público

## Notas de la implementación

- La glosa con hilo quedó como clase CSS (`.glosa` en `componentes.css`, con `--hilo`, `--hilo-punto` y `--retardo`), no como `Glosa.svelte`: no necesitaba lógica y así la usan igual la portada, el video, la búsqueda y «Preguntar».
- Los ejemplos de «Preguntar» se arman con los temas aprobados y los pasajes dichos. No se usan las preguntas guardadas porque serían las de otros visitantes. Al pulsar un ejemplo solo se rellena el campo: cada pregunta cuesta.
- En «Preguntar», el fotograma va en miniatura junto a la cita. A todo el ancho repetía el mismo plano del púlpito y ahogaba las palabras.
- Video: tres pistas desde 68 rem y cuatro (glosas al margen) desde 84 rem. El video lleva como póster su fotograma, el mismo de la colección.
- Verificación (2026-10-27):
  - `npm run lint`, `npm run check` y `npm test` en verde, con 162 pruebas.
  - 21 de 21 comprobaciones con CDP: eventos de teclado de confianza, movimiento reducido y reflujo a 320 px en las seis pantallas.
  - Capturas en claro y oscuro.
  - Fotogramas: 1,2 s en frío y 7 ms desde la caché; con `SHOW_FRAMES=false`, 404 y marcador de respaldo; el video no público tiene su prueba unitaria (`videoPublico`).
- Ojo en desarrollo: `svelte-kit sync` (dentro de `npm run check`) y cualquier segundo `vite dev` reescriben `.svelte-kit/generated/dev/env/config.js` con su propio entorno, y el servidor en marcha lo recarga: pierde `DATA_DIR` y las claves. Hay que reiniciar la demo después.
- Sin probar: lector de pantalla real (NVDA) y un móvil real.
