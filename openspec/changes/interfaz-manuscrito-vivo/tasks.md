## 1. Sistema visual y fotogramas

- [ ] 1.1 ★ Tokens en `base.css` (superficies, sombras tintadas, radios, espaciado, movimiento) en ambos temas
- [ ] 1.2 ★ `componentes.css`: botón, campo, chip, insignia, tarjeta, interruptor; retirar los `:global` del layout
- [ ] 1.3 ★ Prueba `contraste.spec.ts` de los tokens en ambos temas
- [ ] 1.4 ★ `extraerFotograma` en `ffmpeg.ts` y ruta `/videos/[id]/fotograma/[segundo]` con caché, deduplicación y `SHOW_FRAMES`, más sus pruebas
- [ ] 1.5 ★ Componentes `Fotograma.svelte` (con marcador de respaldo) y `Glosa.svelte` (nota con trazo)

## 2. Ruta de la demo

- [ ] 2.1 ★ Cabecera: fija, marca «¶ Glosa», atajo `/`, navegación en píldoras y transiciones entre páginas
- [ ] 2.2 ★ Portada: espécimen vivo, cifras, colección con pósteres y «Cómo funciona»
- [ ] 2.3 ★ Video: pistas, glosas al margen (`pasajesDeVideo`), hilo de progreso, interruptor y «Volver a lo que suena»
- [ ] 2.4 ★ Video: buscar dentro del video y panel «En este video»
- [ ] 2.5 ★ Preguntar: compositor, carga honesta, citas como glosas con trazo y fotograma; panel del estudio
- [ ] 2.6 ★ Búsqueda: encabezado con filtro por video, grupos con póster y «Shown on screen» con fotograma

## 3. Resto de pantallas

- [ ] 3.1 Índice bíblico por testamento, con cuadrícula de libros y referencias en tarjeta
- [ ] 3.2 Editor: acceso, zona de subida y lista de videos con estado

## 4. Verificación

- [ ] 4.1 ★ `npm run check`, `npm run lint` y `npm test` en verde
- [ ] 4.2 ★ Capturas a 1440 y 1024 px y reflujo a 320 px (iframe), en claro y oscuro, comparadas con el antes
- [ ] 4.3 ★ Recorrido con teclado real y comprobación con movimiento reducido
- [ ] 4.4 Fotogramas: frío y caché, `SHOW_FRAMES=false` y 404 de un video no público
