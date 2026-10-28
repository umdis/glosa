Leyenda: ★ = imprescindible para la demo. Lo que no lleva ★ se recorta primero si hay atraso, en el orden que fija `design.md` (Riesgos). Fechas objetivo entre paréntesis.

## 1. Base del proyecto (28-oct)

- [x] 1.1 ★ Crear la app SvelteKit (Svelte 5, TypeScript, `adapter-node`) con lint, formato y pruebas (Vitest)
- [x] 1.2 ★ Dockerfile con ffmpeg y volumen `/data`; `.env.example` con `MODEL_API_KEY`, `ADMIN_TOKEN`, `DAILY_SPEND_CAP_USD` (solo nombres)
- [x] 1.3 ★ Esquema SQLite: `videos`, `fragmentos` (+ tablas FTS5 `fragmentos_raices` y `fragmentos_trigramas`), `en_pantalla`, `pasajes`, `pendientes`, `gasto`; migración inicial y comprobación de que la versión de SQLite tiene el tokenizador `trigram`
- [x] 1.4 ★ Cliente de la Meta Model API (Responses, Files, ASR) con timeouts, reintentos con espera y registro del `usage` en `gasto`

## 2. Ingesta y transcripción (28–29-oct)

- [x] 2.1 ★ Subida de video con clave de administrador; validación con ffprobe; registro con estado `procesando`
- [x] 2.2 ★ Normalización con ffmpeg: H.264 480p para reproducir y WAV mono de 24 kHz para transcribir
- [x] 2.3 ★ Corte en ventanas de 30 s con 5 s de solape y transcripción en paralelo (8 simultáneas) con `languageBias` y palabras clave
- [x] 2.4 ★ Fusión del solape (alineación de palabras) y partición en fragmentos de 20 s o menos, con inicio y fin absolutos
- [x] 2.5 ★ Pruebas de la fusión con las ventanas medidas: sin palabras duplicadas ni perdidas en los bordes; Santiago 1:2 cae en ≈ 06:23
- [x] 2.6 ★ Estado por paso (`procesando` / `listo` / `con errores`), conservación de lo ya hecho y reintento del paso fallido

## 3. Búsqueda por lo dicho (29-oct)

- [x] 3.1 ★ Normalización y raíces en español: elegir y verificar un stemmer Snowball de español con licencia abierta; función única `normalizar` (sin tildes, minúsculas) y `raiz`, compartidas por el indexado y la consulta; comprobar si el stemmer da mejores raíces aplicado antes o después de quitar las tildes
- [x] 3.2 ★ Pruebas de búsqueda con palabras de las prédicas: «tentaciones» → «tentación», «tentacion» sin tilde, y que una palabra corta no dispare los trigramas. Dejar documentado qué pares derivados no une ni el stemmer ni los trigramas (p. ej. «criar» / «crianza»); esos los cubre la reformulación del agente
- [x] 3.3 ★ Endpoint de búsqueda: primero por raíces (`bm25`), luego trigramas sin duplicar; fragmento, video, minuto y contexto con resaltado sobre el texto original; solo contenido visible (aprobado)
- [x] 3.4 ★ Página de video: reproductor y transcripción sincronizada que resalta el fragmento actual
- [x] 3.5 ★ Página de búsqueda con resultados que abren el video en el minuto exacto
- [x] 3.6 Navegación completa con teclado, foco visible y comprobación de contraste (WCAG 2.2 AA)

## 4. Verificación de citas (30-oct)

- [x] 4.1 ★ Normalización de texto (minúsculas, sin tildes ni puntuación) y comparación en orden con umbral configurable
- [x] 4.2 ★ Búsqueda de la frase en el fragmento citado y sus vecinos; anclaje al fragmento real; estados `verificada` / `no verificada`
- [x] 4.3 ★ Marcado de afirmaciones `sin respaldo`; minutos solo desde la transcripción
- [x] 4.4 ★ Pruebas: cita correcta, cita en el fragmento vecino, cita inventada, minuto propuesto por el modelo que se ignora

## 5. Agente investigador (30–31-oct)

- [x] 5.1 ★ Herramientas `buscar`, `leer_fragmentos`, `en_pantalla` y `pasajes`, que excluyen los fragmentos sensibles pendientes
- [x] 5.2 ★ Bucle del agente sobre la Responses API con salida estructurada (afirmaciones con citas por fragmento y frase), tope de pasos y de tokens
- [x] 5.3 ★ Endpoint `/preguntar` que pasa la respuesta por la verificación (sección 4) antes de devolverla
- [x] 5.4 ★ Interfaz de respuesta: afirmaciones, citas con video, minuto y frase, insignia de verificación (texto e icono) y enlace al momento
- [x] 5.5 Ensayar 10 preguntas reales sobre la colección de demo y ajustar el prompt y el umbral de verificación

## 6. Revisión humana y segmentos sensibles (31-oct)

- [x] 6.1 ★ Clasificación de fragmentos sensibles (salud, fallecimientos, menores, personas privadas) con Spark en salida estructurada
- [x] 6.2 ★ Resumen y temas propuestos por video, guardados como `pendientes`
- [x] 6.3 ★ Cola de revisión del administrador: aprobar u ocultar, con registro de quién y cuándo
- [x] 6.4 ★ Pruebas: lo pendiente u oculto no aparece en la búsqueda pública ni en el agente

## 7. Índice bíblico (1-nov)

- [x] 7.1 ★ Tabla del canon (66 libros, capítulos y versículos por capítulo) desde una fuente con licencia abierta, citada en el repo
- [x] 7.2 ★ Detector por reglas en español con ventana de fragmentos vecinos; pruebas con «Santiago capítulo uno… versículo dos»
- [x] 7.3 ★ Validación contra el canon que descarta lo imposible; pruebas con Santiago 9:4
- [ ] 7.4 Pasajes propuestos por Spark (dichos y en pantalla) que pasan por la misma validación
- [x] 7.5 ★ Página de pasajes agrupados por libro con todos los momentos de la colección

## 8. Índice visual (1-nov)

- [x] 8.1 Corte del video en tramos de 10 min, subida a Files API con `expires_after` y borrado al terminar
- [x] 8.2 Extracción de textos en pantalla con su momento (JSON) y guardado en `en_pantalla`
- [x] 8.3 Mostrar los textos en pantalla en la página del video y hacerlos buscables

## 9. Acceso de demo (2-nov)

- [x] 9.1 ★ Vista pública de solo lectura; controles de administrador solo con `ADMIN_TOKEN`
- [x] 9.2 ★ Límite de preguntas por IP y tope diario de gasto con mensaje claro; la búsqueda sigue funcionando
- [x] 9.3 Caché de las respuestas ensayadas como respaldo ante caídas de la API, marcadas como tales

## 10. Estudio citado (2-nov)

- [x] 10.1 Borrador de estudio a partir de una respuesta (solo afirmaciones verificadas)
- [x] 10.2 Edición del texto y exportación a Markdown con citas enlazadas al momento
- [x] 10.3 Vista imprimible para guardar como PDF

## 11. Despliegue y entrega (2–3-nov)

- [ ] 11.1 ★ Remoto público en GitHub y primer push (requiere el usuario de GitHub del propietario)
- [ ] 11.2 ★ App en Dokploy con volumen y variables; registro DNS `glosa.umdis.site` (aprobación explícita del propietario)
- [ ] 11.3 ★ Colección de demo indexada (solo videos con permiso) y revisión de sus pendientes
- [x] 11.4 ★ README en inglés: qué hace, cómo usa los modelos de Meta, arquitectura, cómo correrlo y qué se construyó durante el hackatón
- [ ] 11.5 ★ Guion y grabación del video de 3 min (en inglés o con subtítulos) mostrando solo lo construido en el hackatón
- [x] 11.6 ★ Textos del formulario de entrega (uso de productos de Meta, por qué importan, comentarios) y entrega el 3-nov
- [ ] 11.7 Publicación en X con la demo para el premio «Most Viral» (si el propietario abre la cuenta)
- [ ] 11.8 ★ Actualizar `D:\Proyectos\Agent\projects\Glosa.md` con stack, infraestructura, variables (nombres) y runbook
