## 1. Traza del agente

- [x] 1.1 `alPaso` en `preguntar` con prueba de que los pasos coinciden con las llamadas reales
- [x] 1.2 `atender.ts` (validación, limitador, tope, guardada) compartido por la acción y `POST /ask/stream` (NDJSON)
- [x] 1.3 `/ask` en dos columnas: compositor y respuesta, y el margen del escriba (reposo, en vivo y resumen sin JS)

## 2. Portada, video y navegación

- [x] 2.1 Lámina de tinta con Preguntar como acción principal y arranque desde `/ask?q=`
- [x] 2.2 Espécimen por regla y colofón con cifras reales
- [x] 2.3 Colección a todo el ancho
- [x] 2.4 Mapa de momentos y procedencia en el video
- [x] 2.5 Cabecera móvil estable y búsqueda en la portada; «Use» → «Use this quote»

## 3. Verificación

- [x] 3.1 Pruebas, `check`, `lint` y contraste de los tokens nuevos
- [x] 3.2 axe sin violaciones serias, reflujo a 320 px, movimiento reducido y camino sin JS
- [x] 3.3 Capturas de antes y después, despliegue y verificación desde fuera (dcf9995 en glosa.umdis.site: transmisión sin retención por Traefik, axe 0 en producción, 4/4 citas en vivo)

## Notas de verificación (2026-10-30, demo local)

- 224 pruebas, `check` y `lint` limpios; contraste de la lámina medido en ambos temas.
- axe-core 4.10: 0 violaciones (de cualquier gravedad) en 6 pantallas, claro y oscuro.
- Transmisión real: pasos a los 3,7 / 5,1 / 8,9 s, respuesta a los 20 s, 3/3 citas verificadas.
- Teclado real desde la portada (Tab, Enter) → /ask arranca solo; 7/7 citas; el estado se limpia.
- Movimiento reducido: 0 animaciones. Sin JS: POST con el margen armado y 5 citas verificadas.
- Sin desborde a 390, 1024 y 1440 px. Barras de desplazamiento con la tinta del tema (petición del propietario).
