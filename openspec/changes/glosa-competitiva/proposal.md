## Why

Glosa ya resuelve lo difícil (transcripción con minutos reales, agente con herramientas, citas
verificadas, lectura de pantalla, privacidad), pero quien la mira ve un buscador con preguntas: el
propietario la juzga «muy básica para competir». Además, los modelos de Meta trabajan por dentro y no
se ven en una demo. Quedan 6 días (entrega el 4-nov a las 21:00 ET) para convertirla en una
herramienta de trabajo para pastores y maestros, que además luzca en un video de 3 minutos.

Varias funciones vienen inspiradas en YT Projects, un proyecto previo del autor. **Se reimplementan
desde cero**: el track Indie solo admite trabajo nuevo y no se copia código de ese proyecto.

## What Changes

Ocho capacidades nuevas, por orden de prioridad. Cada fase se despliega al terminarla: si el plazo
aprieta, lo que se cae es lo último de la lista y no lo central.

1. **Investigaciones (cuaderno de estudio).** Un espacio donde se reúnen citas verificadas desde
   «Preguntar», la búsqueda y el video, se ordenan en bloques, se escribe encima, Spark redacta
   secciones citando solo lo que está en el cuaderno, y se exporta a PDF, Word y Markdown. Sin
   cuentas: quien la crea recibe un enlace privado de edición y puede publicar uno de solo lectura.
   *Rúbrica: Impacto, Demo, Profundidad técnica.*
2. **Clips para compartir.** Cada cita verificada se convierte en un clip vertical (9:16) de 30 a
   60 s con subtítulos quemados, título y enlace al minuto, con página propia y vista previa al
   compartir. *Impacto, Demo, premio «Most Viral».*
3. **Cualquier idioma y por voz.** Preguntar en inglés (u otro idioma) sobre prédicas en español:
   la respuesta llega en el idioma de la pregunta y cada cita muestra el original verificado y su
   traducción marcada como tal. Subtítulos en inglés por video. Preguntar hablando al micrófono
   (Muse Voice Transcribe). *Impacto, Uso de Meta, Demo (jurado angloparlante).*
4. **Láminas con Muse Image.** Una investigación o una cita se convierte en una lámina ilustrada
   (portada generada por Muse Image, sin personas) con la frase, la fuente y un código QR al minuto.
   *Uso de Meta, premio creativo (Muse Image/Wonder), Demo.*
5. **Series y etiquetas.** El editor agrupa videos en series; se pregunta dentro de una serie y se
   genera su resumen compilado (aprobado por el editor). Los temas aprobados pasan a ser etiquetas
   navegables y filtrables. *Impacto, Profundidad técnica.*
6. **Caras protegidas con SAM 3.1.** SAM segmenta a las personas del público en fotogramas, clips y
   láminas, y las difumina dejando al predicador. *Uso de Meta (cuarto modelo), Profundidad técnica,
   Impacto (privacidad).*
7. **Glosa en WhatsApp.** Preguntar a la colección por WhatsApp (Cloud API) y recibir las citas
   verificadas con enlace al minuto. *Uso de Meta, Impacto.* Depende de que el propietario registre
   un número en Meta.
8. **Videos de YouTube.** El editor pega el enlace de YouTube de una prédica que sube: Glosa toma
   título, fecha y miniatura por oEmbed y enlaza al original. *Impacto (las iglesias publican ahí).*

## No objetivos

- Cuentas de usuario, equipos o colaboración en tiempo real: las investigaciones son por enlace.
- Descargar videos de YouTube desde Glosa (choca con sus términos). El archivo lo sube el editor,
  descargado desde YouTube Studio o de su origen.
- Editar transcripciones, app móvil, CI/CD automático, otros idiomas de interfaz además del inglés.
- Modelos abiertos en Baseten (Muse Spark Open): solo si sobra tiempo; no entra en las tareas.
- Mensajes de WhatsApp iniciados por Glosa (plantillas, difusión): solo se responde a quien escribe.

## Capabilities

### New Capabilities
- `investigaciones`: cuaderno de estudio con bloques, citas verificadas, redacción asistida que solo cita lo del cuaderno, enlaces de edición y de lectura, y exportación.
- `clips-compartibles`: clip vertical con subtítulos a partir de una cita verificada, su página para compartir y sus límites.
- `idiomas-y-voz`: preguntas en otros idiomas con citas originales y traducidas, subtítulos traducidos y pregunta por voz.
- `laminas-ilustradas`: lámina con ilustración de Muse Image, cita, fuente y QR, con límites de gasto.
- `series-y-etiquetas`: series de videos, preguntas acotadas a una serie, resumen compilado y etiquetas navegables.
- `privacidad-visual`: difuminado de las personas del público con SAM 3.1 en fotogramas, clips y láminas.
- `whatsapp`: canal de preguntas por WhatsApp con verificación de firma, límites y datos mínimos.
- `origen-youtube`: vínculo de un video con su publicación en YouTube y metadatos por oEmbed.

### Modified Capabilities
<!-- Ninguna: las capacidades del cambio nucleo-glosa siguen sin archivar; lo nuevo entra como capacidades propias. -->

## Impact

- **Código:** rutas nuevas (`/investigations`, `/c/[id]`, `/series`, `/topics`, `/api/whatsapp`,
  `/api/voz`), tablas nuevas en SQLite (investigaciones, bloques, clips, láminas, series, etiquetas,
  traducciones, conversaciones de WhatsApp), herramientas del agente con filtro por serie.
- **Modelos de Meta:** se suman Muse Image y SAM 3.1 a Spark y Voice Transcribe. Todo el gasto pasa
  por el tope diario existente.
- **Dependencias nuevas:** generación de QR, exportación a Word (`docx`), composición de imagen
  (SVG → PNG). Todas MIT o equivalentes.
- **Servidor:** ffmpeg hace más trabajo (clips, difuminado): cola de uno en uno y caché en disco
  dentro de `/data`.
- **Externo:** WhatsApp necesita una app de Meta con el producto WhatsApp y un número de prueba; el
  webhook vive en `glosa.umdis.site`.
