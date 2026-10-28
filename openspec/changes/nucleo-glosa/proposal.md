## Why

El conocimiento más valioso de muchas comunidades vive en horas de video (prédicas, clases, charlas) y es casi imposible de usar: no se puede buscar lo que se dijo, encontrar el minuto exacto ni citarlo sin copiar a mano. Glosa lo convierte en conocimiento buscable y citable, y lo construye ahora, durante el Meta Global AI Developer Hackathon (entrega 4-nov-2026, track Indie), sobre los modelos de Meta.

El experimento del 2026-10-27 con dos prédicas reales fijó el enfoque:

- Muse Voice Transcribe transcribe muy bien en español.
- Muse Spark lee la pizarra y las diapositivas con el minuto correcto.
- Pero **Muse Spark se equivoca de 1 a 2 minutos al ubicar lo hablado**. Por eso la promesa central de Glosa —cada afirmación respaldada por el momento exacto, verificado— exige que el sistema verifique, no que confíe en el modelo.

## What Changes

Primera versión de Glosa, de punta a punta: lo mínimo para una demo que funcione en vivo.

- **Ingesta de video**: subir mp4, transcribir con marcas de tiempo finas (ventanas solapadas) e indexar lo que aparece en pantalla.
  - *Rúbrica:* Uso de Meta (Voice Transcribe + visión de Spark), Profundidad técnica.
- **Búsqueda por lo que se dijo** en toda la colección, que salta al momento exacto del video.
  - *Rúbrica:* Impacto, Demo.
- **Agente investigador**: responde preguntas sobre la colección usando herramientas (buscar, leer fragmentos, ver lo que hubo en pantalla). Devuelve afirmaciones con citas, no texto suelto.
  - *Rúbrica:* Uso de Meta (agente con herramientas), Impacto. Opta al premio «Best Agentic Use-Case».
- **Verificación de citas**: el servidor comprueba cada cita contra la transcripción y la ancla al minuto real. Lo que no se verifica no se presenta como respaldado.
  - *Rúbrica:* Profundidad técnica, Demo. Es el diferenciador frente al «RAG básico».
- **Índice bíblico verificado**: pasajes dichos o mostrados en pantalla, validados contra el canon (libro, capítulo, versículo).
  - *Rúbrica:* Impacto (dominio real), Uso de Meta.
- **Revisión humana**: lo que propone la IA (resúmenes, temas, segmentos sensibles) queda pendiente hasta que una persona lo aprueba. Los segmentos con datos sensibles de terceros, como las peticiones de oración por enfermos, se excluyen de la búsqueda pública hasta su revisión.
  - *Rúbrica:* Impacto (IA responsable), Profundidad técnica.
- **Estudio citado**: el agente redacta un borrador de estudio con citas vivas al video; la persona lo edita y lo exporta.
  - *Rúbrica:* Impacto, Demo.
- **Acceso de demo**: colección pública de solo lectura para los jueces; subir y aprobar requiere una clave de administrador; las preguntas tienen límite de uso y tope de gasto.
  - *Rúbrica:* Demo (que aguante en vivo).

### No objetivos

Fuera de este cambio, aunque estaban en la idea de la postulación:

- Importar desde YouTube: no lo permite la API de Meta, choca con los términos de YouTube y hay bloqueos de IP.
- Colaboración, invitaciones, y proyectos públicos o privados por usuario.
- Cuentas de usuario y autenticación completa.
- Editor por bloques: el estudio es un texto editable simple.
- Exportar a Word.
- Capa «cualquier LLM» con varios proveedores.
- Modelos abiertos en Baseten o Modal.
- Muse Image y SAM 3.1.
- Etiquetas manuales.
- Aplicación móvil.

## Capabilities

### New Capabilities

- `ingesta-video`: subida de mp4, normalización, transcripción en ventanas solapadas, índice de lo que aparece en pantalla, y estado y errores del procesamiento.
- `busqueda-por-lo-dicho`: búsqueda de texto completo en toda la colección y salto al momento exacto en el reproductor.
- `agente-investigador`: preguntas en lenguaje natural respondidas por un agente con herramientas, con afirmaciones y citas estructuradas.
- `verificacion-de-citas`: comprobación de cada cita contra la fuente, anclaje al minuto real y marcado de lo no verificado.
- `indice-biblico`: detección de pasajes dichos o mostrados, validación contra el canon y navegación por pasaje.
- `revision-humana`: cola de propuestas de la IA y de segmentos sensibles, pendientes de aprobación humana.
- `estudio-citado`: borrador de estudio redactado por el agente, con citas vivas, edición y exportación a Markdown e impresión a PDF.
- `acceso-demo`: modo público de solo lectura, clave de administrador, límite de uso y tope de gasto.

### Modified Capabilities

Ninguna (proyecto nuevo).

## Impact

- **Código nuevo**: toda la aplicación (repo `Glosa`, construido desde el 27-oct-2026; sin código de proyectos previos).
- **Servicios externos**: Meta Model API (`muse-voice-transcribe-1.0`, `muse-spark-1.3`, Files API), siempre en el tier Standard, nunca en contributor.
- **Dependencias**: ffmpeg en el contenedor; base de datos SQLite con búsqueda de texto completo (FTS5); una tabla del canon bíblico con número de capítulos y de versículos por capítulo, de fuente con licencia abierta.
- **Infraestructura**: una aplicación en Dokploy (`glosa.umdis.site`, el DNS requiere aprobación) con un volumen para la base y los medios. El repo será público en GitHub.
- **Costo estimado**: transcripción ≈ US$0,18 por hora de video; índice visual ≈ US$0,11 por cada 10 min de video; cada pregunta, de centavos. Cabe de sobra en los US$150 de créditos.
