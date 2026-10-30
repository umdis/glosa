## Why

El propietario (2026-10-30) juzga la interfaz insuficiente para ganar: falta impacto visual, **la IA
no se nota**, se ve vacía y el móvil se usa mal. Revisión de producción con capturas a 1440 px:

- Muse Spark y Muse Voice solo se nombran en un párrafo. El agente trabaja 20–30 s tras un esqueleto
  gris, aunque el bucle ya registra cada herramienta. Uso de Meta = 25 % de la rúbrica, más el bono
  de agentes.
- Preguntar, la función estrella, es una acción secundaria en la portada y en `/ask` es una tarjeta
  vacía con el 70 % de la pantalla en blanco.
- Todo tiene el mismo peso y el mismo gris verdoso: a 1080p en un video se lee como un prototipo.
- El espécimen de la portada es «Gracias, mijo, muy oportuno».
- En el móvil, la navegación salta a una segunda línea bajo la marca.

## What Changes

Se mantiene la dirección «manuscrito vivo» (decisión del propietario), con más volumen.

- **Margen del escriba**: el agente emite cada paso real (búsqueda, lectura, redacción y
  verificación) y `/ask` lo dibuja en vivo como glosas al margen. En reposo, el margen muestra las
  4 etapas. Sin JS, se sigue respondiendo por POST y el margen se arma con la respuesta.
- **Procedencia de Meta**: cada modelo se nombra donde actúa: la traza, el colofón de la
  portada y el encabezado del video.
- **Portada**: lámina de tinta a todo el ancho con Preguntar como acción principal, espécimen
  elegido por regla (un versículo que se lee, pocas muletillas), colofón con cifras reales y
  colección a todo el ancho.
- **Video**: un mapa de momentos (pasajes y pantalla) sobre la duración, con el punto que suena.
- **Navegación**: búsqueda también en la portada y una cabecera móvil en dos filas fijas, sin saltos.

## Capabilities

### New Capabilities
- `traza-del-agente`: los pasos reales del agente se transmiten y se muestran mientras responde.
- `procedencia-meta`: la interfaz nombra el modelo de Meta que produjo cada cosa.

## No objetivos

- No se cambian la paleta base, las fuentes ni la dirección visual.
- No se añaden librerías de UI.
- No se recorta ninguna fase de `glosa-competitiva` (decisión del propietario): este cambio se
  limita a ~1 día.
