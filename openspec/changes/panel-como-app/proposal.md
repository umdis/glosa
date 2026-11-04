## Why

El propietario (2026-11-04, día de entrega) ve el panel `/admin` amontonado: es una sola página
larga con todo apilado y, con 400 videos, la lista lateral se volvería decenas de pantallas de
scroll. Cada serie listaría los 400 videos con su casilla. Además, quien clona el repo no sabe de
dónde sale la clave del editor: la elige quien instala (`ADMIN_TOKEN`), pero nada lo explica.

## What Changes

- **El panel es una app**: ocupa el alto de la ventana bajo la cabecera, con márgenes fijos. Un
  riel de secciones (Review, Videos, Upload, Series, Topics, Published) con sus cuentas, y cada
  sección con su propio desplazamiento interno. La página nunca crece con el contenido.
- **Videos maestro-detalle**: lista compacta con búsqueda y filtros por estado (todos, con
  errores, procesando, listos) y el detalle del video elegido al lado. Escala a cientos de videos.
- **Series maestro-detalle**: el editor muestra solo los videos de la serie, en orden y con su
  parte, y un buscador para añadir más; ya no se pintan todos los videos por serie.
- **Clave del editor explicada**: la pantalla de acceso y el README dicen que la clave la define
  quien instala en `ADMIN_TOKEN` y cómo generar una segura.
- Sección y video elegidos viven en la URL (`?s=`, `?v=`): se pueden enlazar y el botón Atrás
  funciona.
- Accesibilidad: en pantallas pequeñas o con zoom alto, el panel vuelve a desplazarse como página
  (reflujo, WCAG 1.4.10); las zonas con scroll son regiones con nombre.

## Capabilities

### Modified Capabilities

- `revision-humana`: el panel del editor se organiza por secciones con desplazamiento propio.

## Impact

`src/routes/admin/+page.svelte` (reescrito), `src/routes/+page.svelte` y `+page.server.ts` (portada paginada), `README.md`. Sin cambios en el servidor, la base de
datos ni las acciones de formulario.
