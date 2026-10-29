## Context

Glosa está en producción (`glosa.umdis.site`): SvelteKit 3 + SQLite en un contenedor de Dokploy, con
volumen `/data`, ffmpeg en la imagen y la Meta Model API (Spark 1.3, Voice Transcribe) detrás de un
tope de gasto diario. No hay cuentas: los visitantes son anónimos y el editor entra con
`ADMIN_TOKEN`. Este cambio añade ocho capacidades en 6 días; el diseño prioriza reutilizar lo que
Glosa ya tiene (verificación de citas, agente, fotogramas, cola de ingesta, límites) y desplegar
por fases.

Restricción de origen: las ideas vienen de YT Projects, pero **no se mira ni se copia su código**.

## Goals / Non-Goals

**Goals:**
- Que la demo muestre trabajo útil de punta a punta: preguntar → guardar citas → investigación →
  lámina/clip → compartir, en inglés y por voz.
- Que cada modelo de Meta se vea haciendo algo (Spark, Voice, Image, SAM) y que el agente gane
  alcance (series, investigación).
- Mantener las garantías: nada sin verificar se muestra como cita, nada oculto sale por un canal
  nuevo, todo gasto pasa por el tope.

**Non-Goals:** ver `proposal.md` (cuentas, descargas de YouTube, edición de transcripciones, etc.).

## Decisions

**D1. Investigaciones por enlace con secreto, no por cuenta.** Tabla `investigaciones (id, titulo,
secreto_hash, publicada, creada_en, actualizada_en, portada)` y `bloques (id, investigacion_id,
orden, tipo, texto, fragmento_id, origen_ia)`. El enlace de edición es `/investigations/<id>?k=<secreto>`
(32 bytes aleatorios; se guarda solo el hash SHA-256). El secreto se pasa a una cookie `httpOnly`
por investigación al abrirlo, para no dejarlo en el historial de navegación al compartir la URL de
lectura. *Alternativa descartada:* cuentas (no caben en el plazo y añaden datos personales).
*Alternativa descartada:* solo `localStorage` (no sirve para compartir ni para exportar en el
servidor).

**D2. Las citas se guardan por `fragmento_id`, nunca por texto.** El texto se lee siempre de la
tabla de fragmentos al mostrar o exportar, filtrando por `visibilidad = 'visible'`. Así una cita
oculta después queda «retirada» sin lógica extra.

**D3. «Draft with Spark» reutiliza el verificador.** Se manda a Spark solo la lista de fragmentos del
cuaderno (id + texto) y se pide salida estructurada `{bloques: [{tipo, texto, citas: [{fragmento_id,
frase}]}]}`. Cada cita pasa por `verificar.ts` contra *ese* fragmento; si `fragmento_id` no está en
el cuaderno o no verifica, se descarta y se cuenta.

**D4. Exportación a Word con la librería `docx`** (MIT, sin dependencias nativas), con hipervínculos
al minuto. El PDF sigue siendo la vista imprimible del navegador (ya existe para el estudio).

**D5. Clips con ffmpeg en un solo paso.** Ventana = cita ± contexto hasta 15–60 s, recortada a los
bordes de fragmentos visibles contiguos. Filtro: fondo = video escalado y difuminado a 1080×1920,
encima el video a 1080 de ancho centrado, subtítulos quemados desde un `.ass` generado de los
fragmentos (fuente Alegreya Sans empaquetada), título arriba y `glosa.umdis.site` abajo. Salida
H.264 + AAC, `-preset veryfast`. Caché en `/data/medios/<video>/clips/<fragmento>.mp4`. Cola en
memoria de 1 en 1 con máximo 3 esperando; deduplicación de peticiones iguales (igual que los
fotogramas). Página `/c/<fragmento>` con `og:video` y `og:image`.

**D6. Idiomas: el agente decide la lengua de respuesta; las traducciones son otra llamada.** Se
añade al prompt del agente «answer in the language of the question; search in Spanish». Las
traducciones de citas se piden en lote a Spark (salida estructurada `{id, traduccion}`) después de
verificar, se guardan en `traducciones (fragmento_id, idioma, texto)` y se reutilizan. Los
subtítulos traducidos se generan en lote por video (bloques de ~80 fragmentos) desde `/admin` y se
sirven en `captions.vtt?lang=en`.

**D7. Voz: el navegador graba y convierte a WAV mono 16 kHz.** `MediaRecorder` → `AudioContext`
(`OfflineAudioContext` a 16 kHz) → PCM de 16 bits → `POST /api/voz` (máx. 30 s ≈ 1 MB). El servidor
valida la cabecera WAV y la duración, llama a Voice Transcribe y devuelve el texto. No se guarda el
audio. Límite por visitante y tope de gasto.

**D8. Láminas: Muse Image + composición SVG → PNG.** Prompt construido en el servidor desde el tema
(sin la frase, sin nombres): «abstract editorial illustration, no people, no faces, no text, muted
vellum and iron-gall palette, about: <tema>». La lámina se compone como SVG (fuentes Alegreya
embebidas, frase con ajuste de líneas, fuente, QR) y se rasteriza con `@resvg/resvg-js` (binarios
precompilados para linux-x64 glibc, el de `node:22-bookworm-slim`). QR con `qrcode` (MIT). Caché en
`/data/laminas/`. *Riesgo:* formato exacto de la API de Muse Image sin probar → tarea de
reconocimiento primero.

**D9. Series: tablas `series` y `series_videos`; el agente recibe un `ambito`.** `herramientas.ts`
añade `AND video_id IN (…)` a cada consulta cuando hay ámbito, y la verificación final rechaza citas
de videos fuera del ámbito. El resumen compilado entra en la tabla `pendientes` existente con un tipo
nuevo, así reutiliza la cola de `/admin`.

**D10. Etiquetas = temas aprobados normalizados.** Se crea `etiquetas (id, nombre, slug)` y
`video_etiquetas`, alimentadas al aprobar fichas (y una migración para las ya aprobadas). Fusionar
= reasignar y borrar. El filtro de búsqueda añade un `JOIN`.

**D11. SAM 3.1 detrás de una interfaz `Difuminador`.** Contrato: `difuminar(jpeg) → jpeg | null`.
Implementación: pedir a SAM las máscaras de «person», elegir como orador la máscara de mayor área
cuyo centro esté en el tercio central superior, y componer con ffmpeg (`boxblur` + `alphamerge` con
la máscara invertida). Si algo falla → `null` → la interfaz muestra el minuto (ya existe ese
respaldo para `SHOW_FRAMES=false`). En clips, máscaras cada 0,5 s con interpolación; si el coste o
el tiempo no dan, los clips de videos con privacidad visual se generan sin imagen (fondo + audio +
subtítulos). *Riesgo alto:* API de SAM sin probar → reconocimiento primero; la fase puede reducirse
a fotogramas y láminas.

**D12. WhatsApp: webhook propio, sin SDK.** `GET /api/whatsapp` (reto con `WHATSAPP_VERIFY_TOKEN`) y
`POST` con verificación HMAC-SHA256 del cuerpo crudo con `WHATSAPP_APP_SECRET` (comparación en
tiempo constante). Responde 200 enseguida y procesa en segundo plano; envía con
`POST graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages` y `WHATSAPP_TOKEN`. Remitente guardado
como HMAC del número (no reversible) solo para el límite diario. Formato: respuesta corta + hasta 3
citas con «▶ 12:30 https://glosa.umdis.site/videos/…». Dependencia del propietario: app de Meta con
WhatsApp, número de prueba y destinatarios de prueba registrados.

**D13. YouTube solo por oEmbed.** `GET https://www.youtube.com/oembed?url=…&format=json` (sin clave),
con validación estricta del host antes de pedir nada. Columna `youtube_url` en `videos`. Enlaces
«Watch on YouTube» con `t=<segundos>`.

**D14. Interfaz: misma dirección «manuscrito vivo».** Las acciones nuevas en una cita (Add to
investigation, Make a clip, Make a card) van en un menú de acciones accesible (botón con
`aria-expanded`, lista de botones, Escape cierra y devuelve el foco). Nada depende de arrastrar.

## Risks / Trade-offs

- [APIs de Muse Image y SAM sin probar] → una tarea de reconocimiento de ≤1 h al inicio de cada fase;
  si no responden como se espera, la fase se reduce (sin SAM en clips) o se cae, y se dice en el
  envío.
- [CPU del servidor con clips y difuminado] → cola de uno en uno, `veryfast`, caché, límites por
  visitante. El servidor tiene 4 OCPU compartidas con otras apps.
- [Gasto] → todo pasa por `gasto.ts`; tope diario de la demo. Las láminas cuestan 0,01 USD, SAM
  0,20 USD por 1.000 fotogramas.
- [Investigaciones como vía de abuso (texto libre público)] → solo se publican si su autor lo pide,
  límites de tamaño, `noindex` en las no destacadas, el editor puede despublicar desde `/admin`.
- [WhatsApp depende de terceros] → es la fase 7; si Meta no habilita el número a tiempo, la demo
  muestra la integración con el número de prueba o se excluye.
- [Plazo: 8 capacidades en 6 días] → orden estricto por fases con despliegue al final de cada una;
  el corte se hace por el final de la lista.

## Migration Plan

- Las migraciones de SQLite son aditivas (tablas y columnas nuevas) y se aplican al arrancar, como
  hasta ahora. Antes del primer despliegue de este cambio se copia `glosa.db` del volumen a
  `/home/ubuntu/glosa-respaldos/` (no hay backup automático del volumen todavía).
- Variables nuevas en Dokploy (solo nombres): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `PRIVACY_BLUR` (por defecto apagada).
- Reversión: redesplegar el commit anterior; las tablas nuevas quedan sin uso y no estorban.

## Open Questions

- ¿El propietario puede crear la app de Meta con WhatsApp y añadir su número como destinatario de
  prueba antes del 2-nov?
- ¿La privacidad visual se activa por defecto en las dos prédicas de la demo, o el permiso cubre
  mostrar a la congregación?
