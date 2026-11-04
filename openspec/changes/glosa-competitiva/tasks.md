Tareas de ~2 h como máximo. ★ = imprescindible para la demo. Cada fase termina con despliegue y
verificación desde fuera; si el plazo aprieta, se corta por el final.

## 0. Preparación

- [x] 0.1 ★ Copia de `glosa.db` del volumen a `/home/ubuntu/glosa-respaldos/` antes del primer deploy del cambio
- [x] 0.2 ★ Acción de cita accesible en Preguntar, búsqueda y video, con prueba de teclado — hecha como enlace «Save to investigation» que sin JS lleva a `/investigations/save` y con JS abre un `<dialog>` nativo (foco, Escape, vuelta del foco). Las acciones de las fases 2 y 4 se suman al mismo diálogo.

## 1. Investigaciones (29-oct)

- [x] 1.1 ★ Esquema `investigaciones` y `bloques` con migración, más funciones de acceso a datos y pruebas
- [x] 1.2 ★ Secreto de edición: generación, hash, cookie por investigación y guardas de edición/lectura, con pruebas
- [x] 1.3 ★ Página `/investigations` (crear, lista de las propias) y página de edición con bloques título/texto/cita/nota
- [x] 1.4 ★ Reordenar, editar y borrar bloques sin JavaScript obligatorio, con «Move up/down» y anuncio por `aria-live`
- [x] 1.5 ★ «Add to investigation» desde Preguntar, búsqueda y video; solo fragmentos visibles; citas retiradas
- [x] 1.6 ★ «Draft with Spark»: salida estructurada, verificación por fragmento del cuaderno, conteo de descartadas, marca IA
- [x] 1.7 ★ Publicar con enlace de lectura y exportar a Markdown y vista imprimible
- [x] 1.8 Exportar a Word (`docx`) con hipervínculos al minuto
- [x] 1.9 ★ Límites (por visitante, bloques, redacciones) y tope de gasto; despublicar desde `/admin`
- [x] 1.10 ★ Despliegue y verificación en producción (crear, citar, redactar, exportar)

## 2. Clips para compartir (30-oct)

- [x] 2.1 ★ Cálculo de la ventana del clip (15–60 s, bordes de fragmentos visibles) con pruebas
- [x] 2.2 ★ Generación de subtítulos `.ass` desde fragmentos y fuente empaquetada en la imagen
- [x] 2.3 ★ Comando ffmpeg 9:16 (fondo difuminado, video, subtítulos, título, dirección) y caché en disco
- [x] 2.4 ★ Cola de uno en uno con deduplicación, límite de espera y límite por visitante
- [x] 2.5 ★ Página `/c/[fragmento]` con reproductor, frase, enlace al minuto y Open Graph
- [x] 2.6 ★ Acción «Make a clip» con progreso accesible; despliegue y prueba real compartiendo el enlace

## 3. Cualquier idioma y voz (31-oct)

- [x] 3.1 ★ Agente responde en el idioma de la pregunta (prompt + prueba con pregunta en inglés)
- [x] 3.2 ★ Traducción de citas verificadas en lote, tabla `traducciones` y presentación «Translation by Muse Spark»
- [x] 3.3 Subtítulos en inglés por video desde `/admin` y pista `captions.vtt?lang=en`
- [x] 3.4 ★ Grabación en el navegador → WAV 16 kHz mono (≤30 s), estados accesibles, sin envío automático
- [x] 3.5 ★ `POST /api/voz` con validación del WAV, Voice Transcribe, límites y gasto
- [x] 3.6 ★ Despliegue y prueba real (pregunta en inglés hablada) — 2fabc69 en producción: voz exacta en 1,7 s, 9/9 citas verificadas y traducidas; subtítulos en inglés los lanza el editor desde /admin

## 4. Láminas con Muse Image (1-nov)

- [x] 4.1 ★ Reconocimiento de la API de Muse Image (formato de petición/respuesta, tamaños, coste real) con una llamada — POST /v1/images/generations (OpenAI), b64_json; WebP 1920×1280 por defecto; size 1024x1536 + output_format png → PNG 1280×1920 en ~25 s; usage en tokens, precio 0,01 USD/imagen.
- [x] 4.2 ★ Composición (ilustración, frase, fuente, QR, mención) → PNG y prueba de la imagen resultante — con ffmpeg + ASS + Alegreya Sans, como los clips, en vez de resvg: el servidor es ARM y así no entra un binario nativo nuevo. QR con qrcode-generator (MIT, sin dependencias) a tamaño nativo; verificado decodificándolo con jsQR.
- [x] 4.3 ★ «Make a card» para citas, caché y gasto
- [x] 4.4 Portada de investigación publicada y `og:image` — la misma lámina con el título (sin comillas: no es una cita), la cuenta de citas vigentes y un QR a la lectura; solo publicada, 3 por visitante y día; despublicar la oculta (404)
- [x] 4.5 ★ Despliegue y verificación mirando la lámina generada — en producción en 36 s; QR decodificado con jsQR abre el minuto (200); axe 0

## 5. Series y etiquetas (1-nov / 2-nov)

- [x] 5.1 Esquema `series`, `series_videos`, `etiquetas`, `video_etiquetas`; migración de temas ya aprobados — migración 6; además `etiquetas_alias` para que un tema fusionado no resucite al volver a aprobarse
- [x] 5.2 Gestión de series en `/admin` y página pública `/series` y `/series/[id]` — también en la portada y en la navegación («Series & topics»)
- [x] 5.3 Ámbito de serie en las herramientas del agente y rechazo de citas fuera de ámbito, con pruebas — `/ask?serie=`; la respuesta guardada se indexa por serie y se vuelve a filtrar si la serie pierde un video
- [x] 5.4 Resumen compilado de serie como pendiente en la cola de revisión — **desviación de D9:** tabla propia `series_resumenes` en vez de `pendientes` (esa exige `video_id` y un CHECK de tipo; rehacerla con datos de producción no compensaba). Sale en la misma cola de `/admin`
- [x] 5.5 Página `/topics` (y `/topics/[slug]`), filtro por etiqueta en la búsqueda (`?tag=`, GET con botón) y fusión de etiquetas en `/admin` — verificado en la demo: 251 pruebas, axe 0 en 8 pantallas × 2 temas, sin desborde a 390 px (se arregló de paso el que ya tenía `/admin`)
- [x] 5.6 Despliegue y verificación — `d16799a` desplegado el 4-nov tras el respaldo `respaldo-20261104-1303.db`; rutas nuevas 200 y axe 0 en producción. En producción no hay etiquetas ni series hasta que el editor apruebe fichas y cree series

## 6. Privacidad visual con SAM 3.1 (2-nov)

- [x] 6.1 Reconocimiento de la API de SAM 3.1 con un fotograma real (máscaras, formato, coste, latencia) — `POST /v1/responses`, `input_text` «person» + `input_image` en data URL, sin streaming; salida en `output_text`: `<0f>id<|box;x1;y1;x2;y2;w;h;c|><|mask;…;data=H,W,!base85|>`. `usage.images_processed` (0,0002 USD). 1,1–1,9 s por cuadro de 640 px. Escena sintética de Muse Image (nadie real): 21 personas, confianza 0,82–0,93
- [x] 6.2 `Difuminador`: elección del orador y composición con ffmpeg; respaldo al minuto si falla, con pruebas — **desviaciones de D11:** se difumina la *caja* con margen del 8 % (la máscara viene en un base85 sin decodificador publicado); el orador no es la caja más grande (en un plano desde el fondo lo es el público del primer plano) sino, entre las centradas, la que empieza más arriba; sin nadie centrado se difumina a todos
- [x] 6.3 Fotogramas y láminas difuminados con caché; interruptor por video en `/admin` con vista antes/después — caché en `medios/<video>/difuminados/`; si SAM falla o hay tope, 404 y la interfaz muestra el minuto. Las láminas no usan fotogramas (son ilustraciones), no aplica. Los fotogramas dejan de ser `immutable` (max-age 600) para que activar la privacidad no deje el original en cachés. El video completo sigue reproduciéndose tal cual, y `/admin` lo dice
- [x] 6.4 Clips: máscaras cada 0,5 s o, si no da el tiempo/coste, clip sin imagen para videos con privacidad — sin imagen (80 llamadas por clip no compensan); verificado mirando un cuadro del clip generado
- [x] 6.5 Despliegue y verificación visual — `2175eb7` tras `respaldo-20261104-1311.db`; en producción: vista previa solo con sesión, fotograma público difuminado en 1,1 s y 18 ms desde caché; privacidad vuelta a apagar

## 7. WhatsApp (2-nov / 3-nov)

- [x] 7.1 Webhook GET (reto) y POST con verificación HMAC en tiempo constante, con pruebas de firma
- [x] 7.2 Procesar en segundo plano: agente, formato del mensaje con hasta 3 citas, envío por Graph API
- [x] 7.3 Remitente como HMAC, límite diario por número, tope de gasto, mensajes no de texto — migración 8 (whatsapp_uso: HMAC del número y día, sin número ni texto), 10 preguntas por número y día, reintentos deduplicados por id; inerte sin las variables WHATSAPP_*
- [ ] 7.4 Configuración en Meta (con el propietario): app, número de prueba, webhook y suscripción; prueba real

## 8. YouTube (3-nov)

- [x] 8.1 Columna `youtube_url`, validación de host y oEmbed al subir o editar, con pruebas — migración 9 (youtube_url, youtube_canal); validación de host e id antes de cualquier petición; campo opcional al subir que rellena el título solo si está vacío; editable por video en /admin
- [x] 8.2 «Watch on YouTube» en el video y en las citas con `t=` — en la página del video sigue al reproductor («Watch on YouTube at 12:30») y en cada cita verificada de /ask

## 9. Cierre

- [x] 9.1 ★ README y `docs/submission.md` actualizados con las capacidades nuevas y los modelos usados — README (capacidades, modelos, variables, accesibilidad, estado) y borrador de entrega con aviso sobre WhatsApp
- [x] 9.2 ★ Guion del video ajustado al flujo nuevo (preguntar en inglés por voz → investigación → lámina/clip) — 2:55 con checklist (fichas aprobadas y una serie en producción, WhatsApp condicionado a 7.4, escena de SAM rotulada como sintética)
- [x] 9.3 ★ Accesibilidad: recorrido de teclado y prueba con lector de pantalla de las pantallas nuevas — teclado real por CDP (serie: saltar, preguntar y Enter; búsqueda: tema con lista + «Filter», sin cambio automático; temas), foco visible siempre, encabezados en orden y ningún control sin nombre; axe 0 en todas las pantallas nuevas. **Pendiente del propietario: prueba con NVDA real**
- [ ] 9.4 ★ Actualizar `D:\Proyectos\Agent\projects\Glosa.md` y la bitácora
