## Context

Glosa se construye desde cero durante el hackatón (27-oct a 4-nov-2026; objetivo interno, el 3-nov). La mantiene una sola persona con el agente como colaborador. Si el hackatón sale bien, puede seguir como producto, así que tiene que poder retomarse meses después sin reconstruir el contexto.

Datos medidos el 2026-10-27 con dos prédicas reales en español (43 y 69 min). Son la base de las decisiones:

| Medición | Resultado |
|---|---|
| Transcripción (`muse-voice-transcribe-1.0`, HTTP) | Muy buena calidad; 10 min en 73 s. Máximo 10 min o 32 MB de WAV por petición. Marcas **por turno**, y un turno llegó a durar 2 min 23 s |
| Transcripción en ventanas de 20 s | Marcas cada 3 a 20 s; en los bordes se pierden palabras («prueba de vuestra [fe] produce») |
| Muse Spark viendo video | 1 min ≈ 16,5 K tokens; 10 min ≈ 86 K; 43 min ≈ 111 K (crece mucho menos que la duración: muestrea menos fotogramas cuanto más largo) |
| Minutos de **lo hablado** según Spark | Se corren de 1 a 2 min |
| Minutos de **lo que aparece en pantalla** según Spark (recortes de 10 min) | Exactos al segundo, comprobados fotograma a fotograma (pizarra en 03:13 y 04:50, diapositiva en 07:04) |
| `/v1/responses/input_tokens` | No cuenta el video (171 tokens para cualquier duración) |
| Contenido | Las prédicas incluyen peticiones de oración por enfermos y fallecidos: datos sensibles de terceros |

## Goals / Non-Goals

**Goals:**
- Un flujo de demo que funcione en vivo: subir → transcribir e indexar → buscar → preguntar → respuesta con citas verificadas → saltar al minuto → estudio citado → exportar.
- Que ningún minuto mostrado al usuario dependa de la estimación del modelo.
- Un despliegue en un solo contenedor, fácil de retomar.

**Non-Goals:**
- Escalar a muchos usuarios simultáneos o a colecciones de miles de horas.
- Multiusuario, cuentas o colaboración.
- Independencia del proveedor de IA: es una sola implementación sobre Meta, detrás de una interfaz pequeña.
- Precisión por palabra en las marcas de tiempo; basta con la del fragmento, de unos segundos.

## Decisions

### D1. SvelteKit (Svelte 5, TypeScript) full-stack en un solo contenedor
Un solo despliegue (`adapter-node`) que sirve la interfaz, la API y los trabajos en segundo plano. Es el stack más reciente del propietario (Cubosfera), lo que reduce la fricción en 8 días; el código se escribe nuevo.
- *Alternativas:* FastAPI + SPA (dos piezas que desplegar y coordinar); Next.js (más peso sin beneficio aquí).

### D2. SQLite (`better-sqlite3`) con FTS5 en un volumen
Sin servidor de base de datos que mantener: las pruebas corren en memoria y el volumen de la demo es mínimo.
- *Alternativas:* MongoDB (búsqueda de texto más pobre en español y un servicio más); Postgres (búsqueda nativa en español con `to_tsvector('spanish')` + `unaccent` y camino a pgvector, pero es un servicio más que operar y probar). Postgres es el camino correcto si Glosa sigue como producto (ver Registro de decisión).
- *Deuda aceptada:* un solo proceso escritor. Ver Riesgos.

### D2b. Búsqueda en español: raíces en la app + trigramas
FTS5 quita tildes (`unicode61 remove_diacritics 2`) pero **no tiene raíces en español**: «tentaciones» no encontraría «tentación», ni «criar», «crianza». Lo resolvemos sin cambiar de base de datos:
- **Índice por raíces** (`fragmentos_raices`, FTS5 `unicode61 remove_diacritics 2`):
  - al indexar se guarda el texto normalizado (minúsculas, sin tildes) y pasado por un **stemmer Snowball de español** hecho en la app (un paquete npm con licencia abierta, a elegir y verificar en la tarea 3.1);
  - la consulta pasa por el mismo proceso;
  - el orden es por `bm25`.
- **Índice de trigramas** (`fragmentos_trigramas`, FTS5 `tokenize='trigram'`, disponible desde SQLite 3.34) para coincidencias parciales y palabras que el stemmer no une. Solo se consulta con términos de 3 caracteres o más.
- **Fusión:** primero los resultados por raíz y luego los de trigramas que falten, sin duplicados.
- **Resaltado:** se calcula en la app sobre el **texto original** del fragmento, nunca sobre el texto con raíces, que no se muestra.
- La comparación de las citas (D7) usa la misma normalización, pero **sin raíces**: una cita tiene que coincidir con las palabras dichas, no con su raíz.

### D3. Sin embeddings: búsqueda léxica + agente + contexto largo
La API de Meta no ofrece embeddings, y un proveedor externo diluiría el «Uso de Meta».
- El agente compensa las paráfrasis: reformula y lanza varias búsquedas.
- Para leer usa el contexto de 1M de tokens de Spark. Las transcripciones son pequeñas, ~13 K tokens por hora (estimación), así que una colección de demo cabe entera.
- *Alternativa:* embeddings de terceros. Se descartan para este cambio.

### D4. Transcripción en ventanas solapadas, en paralelo
- ffmpeg saca WAV mono de 16 bits a 24 kHz y lo corta en **ventanas de 30 s que se solapan 5 s**.
- Se envían a `POST /v1/asr/transcribe` con 8 peticiones simultáneas. Cada una pide `languageBias` y palabras clave del dominio (nombres de libros bíblicos).
- **Fusión:** en la zona de solape se alinean las palabras de las dos ventanas (la secuencia común más larga) y se queda una sola copia. Así se recuperan las palabras cortadas en los bordes.
- Cada fragmento resultante guarda su inicio y fin absolutos. Los fragmentos cortos (< 20 s) son la unidad de cita.
- *Alternativas:* ventanas de 10 min (marcas de hasta 2 min, medido); WebSocket con resultados parciales (va a velocidad real: 43 min de video tardan 43 min, y es más complejo).

### D5. Índice visual solo para lo que aparece en pantalla
- El video se pasa a H.264 en 480p (el original puede venir en AV1 o VP9) y se corta en tramos de 10 min.
- Cada tramo se sube por Files API (con `expires_after` de 1 día y borrado explícito al terminar) y `muse-spark-1.3` devuelve en JSON los textos en pantalla con su momento.
- De Spark se usan **solo** los momentos de lo visual, que medimos como exactos. Sus resúmenes se guardan, pero se anclan a fragmentos de la transcripción, nunca a minutos que diga el modelo.
- Costo medido ≈ US$0,11 por tramo de 10 min.

### D6. Agente con herramientas; el modelo nunca escribe minutos
- `muse-spark-1.3` en la Responses API, con estas herramientas: `buscar(consulta)` (FTS), `leer_fragmentos(video, desde_id, hasta_id)`, `en_pantalla(video)` y `pasajes(referencia)`.
- Tope de 8 pasos y de tokens por pregunta.
- **Salida estructurada:** `{respuesta, afirmaciones: [{texto, citas: [{fragmento_id, frase}]}]}`. El modelo cita por **identificador de fragmento y frase textual**. El minuto lo pone el servidor.
- *Alternativa:* RAG de un solo paso, en el que se recupera y luego se genera. Es más simple, pero es justo el «RAG básico» que veta el hackatón, y no permite que el modelo vaya a buscar más evidencia.

### D7. Verificación de citas en el servidor
Cada cita se normaliza (minúsculas, sin tildes ni puntuación) y se busca en el fragmento citado y sus vecinos inmediatos.
- **Verificada:** coincide al menos el 85 % de los tokens en orden. El minuto queda en el inicio del fragmento donde está la frase.
- **No verificada:** no se presenta como respaldo. Se muestra marcada.
- Una afirmación sin ninguna cita verificada queda marcada como **sin respaldo**.
- El umbral es configurable y se calibra con las dos prédicas medidas.

### D8. Índice bíblico: detector determinista + propuesta de la IA, ambos validados
- **Un detector por reglas** sobre la transcripción:
  - reconoce los nombres de libros en español con sus variantes;
  - reconoce los patrones «capítulo N versículo M» y «N:M»;
  - mira una ventana de fragmentos vecinos, porque la cita puede venir repartida («Santiago capítulo uno… versículo dos»).
- **Spark** propone pasajes a partir de lo hablado (en texto) y de lo que hay en pantalla.
- **Todo pasa por la tabla del canon**: 66 libros, número de capítulos y de versículos por capítulo. Lo imposible, como Santiago 9:4, se descarta. La tabla sale de una fuente con licencia abierta, citada en el repo.

### D9. Segmentos sensibles y revisión humana
- Spark clasifica los fragmentos por categoría: salud, fallecimientos, menores, o personas privadas con nombre.
- Los marcados quedan **pendientes** y fuera de la búsqueda pública y de las respuestas del agente hasta que una persona los aprueba o los oculta.
- Igual con los resúmenes y temas propuestos.
- **Los fragmentos nacen ocultos** (`pendiente`) al transcribirse y solo se publican cuando termina la clasificación (decidido durante la implementación, 2026-10-27). Así no hay ninguna ventana en la que una petición de oración sea pública por accidente: si la clasificación falla, todo sigue oculto hasta reintentarla.
- Las peticiones de oración ocupan bloques. Por eso se rellenan los huecos de hasta 3 fragmentos entre dos marcados y cada bloque se extiende un fragmento hacia cada lado.
  - Esto se endureció tras el ensayo del 2026-10-27: con la regla anterior, de un solo hueco y sin extensión, la pregunta «¿Por quién oraron?» devolvió dos nombres de personas privadas, que estaban en el fragmento que abría el bloque y en un hueco de dos.
- Las respuestas guardadas como respaldo se borran ante cualquier cambio de visibilidad. Además, al servirlas se vuelven a verificar contra la base: así una respuesta vieja no puede citar lo que se ocultó después.
- Reclasificar nunca deshace una decisión humana.
- **Nunca se usa el tier contributor**, que entrena con los datos.
- El panel del editor (`/admin`) entra con la clave en una cookie `httpOnly` y `SameSite=Strict` que guarda un resumen de la clave, no la clave.

### D10. Seguridad y costo de la demo
- `MODEL_API_KEY` vive solo en el servidor (variable en Dokploy).
- Los jueces ven una colección pública de solo lectura. Subir, aprobar y borrar requieren `ADMIN_TOKEN`.
- `/preguntar` tiene un límite por IP y un **tope diario de gasto**, calculado con el `usage` de cada respuesta. Al superarlo responde con un mensaje claro.

### D11. Interfaz en inglés, contenido en su idioma, accesible
- La interfaz va en inglés, para los jueces. Las respuestas salen en el idioma de la pregunta.
- WCAG 2.2 AA: reproductor y resultados manejables con teclado, foco visible, contraste suficiente.
- La transcripción sincronizada es en sí misma una mejora de accesibilidad.

### D12. Dirección visual: «el manuscrito vivo» (aprobada el 2026-10-27)
El propietario pidió (2026-10-27) una estética moderna y nada convencional, ligada al nombre y al propósito. Una *glosa* es la nota que los copistas escribían en el margen o entre líneas para explicar el texto. La *Glossa Ordinaria* era la gran glosa medieval de la Biblia. La interfaz toma de ahí su gramática, **sin imitar pergamino ni letra gótica**:
- **Página con márgenes vivos.** La transcripción es la columna central de texto. Las respuestas, las citas y los pasajes viven en el margen como glosas, unidas por un trazo fino a la frase que comentan. El video ocupa el lugar de la miniatura iluminada, arriba de la página.
- **Rubricación.** Los copistas usaban tinta roja para las rúbricas y las referencias. En Glosa, **el rojo se reserva solo para los momentos verificados** (minutos y referencias en los que se puede hacer clic).
  - Es el único color de acento.
  - Nunca es la única señal: siempre va acompañado de texto o de un icono.
- **Los minutos como folios.** Las marcas de tiempo se componen como numeración de folio («¶ 06:23»), con tipografía monoespaciada.
- **Búsqueda como concordancia.** Los resultados se alinean al estilo de las concordancias bíblicas (palabra clave en contexto, centrada en su columna). Es distinto y además funcional para leer de un vistazo.
- **Tipografía.** Una serif contemporánea con raíz caligráfica para el texto, una grotesca para la interfaz y una monoespaciada para los folios. Fuentes alojadas en la propia app (`@fontsource`), sin CDN de terceros.
- **Color.** Fondo «vitela» liso (sin textura), tinta casi negra y rojo de rúbrica con contraste AA. Modo oscuro «tinta de noche».
- **Movimiento mínimo y con sentido.** Al verificarse una cita aparece un pequeño sello, y el trazo de la glosa se dibuja hacia su frase. Se respeta `prefers-reduced-motion`.
- Antes de implementar la interfaz (tarea 3.4) se invocan las skills `frontend-design` y `jesus-dev:jesus-accessibility`.

### Registro de decisión (largo plazo)
- **Decisión tomada:** SQLite + FTS5 en un solo contenedor, búsqueda léxica sin embeddings y un único proveedor (Meta).
- **Por qué ahora:** 8 días, una sola persona, una demo que tiene que aguantar en vivo.
- **El camino correcto a futuro:** Postgres con búsqueda en español y vectores; cola de trabajos persistente; capa de proveedores intercambiable.
- **Cuándo revisarlo:** si Glosa sigue después del 9-nov, o al pasar de unas 200 horas indexadas o de varios usuarios que escriben a la vez.
- **Registrado en:** este `design.md` y en `D:\Proyectos\Agent\projects\Glosa.md`.

## Risks / Trade-offs

- [Spark vuelve a correr los minutos, o la fusión de ventanas los desalinea] → Los minutos salen siempre de la transcripción (D6, D7). Hay pruebas de la fusión con las ventanas medidas, y una prueba que compara con las marcas ya conocidas (Santiago 1:2 ≈ 06:23).
- [La búsqueda léxica no encuentra paráfrasis] → El agente reformula y lanza varias consultas. Además, la demo se ensaya con preguntas reales.
- [El stemmer une palabras distintas o separa formas de la misma («sé»/«ser», verbos irregulares)] → El índice de trigramas cubre parte de los fallos. Hay pruebas con palabras reales de las prédicas, y el resaltado sobre el texto original deja ver por qué coincidió un resultado.
- [Se cae la API de Meta o salta un límite durante la demo en vivo o la grabación] → La colección de demo ya va indexada. Las respuestas de las preguntas ensayadas se guardan en caché como respaldo, avisando de que vienen de caché. Se graba el video antes del 3-nov.
- [Aparecen datos sensibles de terceros en la demo pública] → Revisión humana obligatoria (D9). La colección pública solo muestra lo aprobado.
- [Derechos del contenido de la demo] → Solo videos con permiso escrito de la iglesia o con licencia abierta. Pendiente de confirmar (ver Preguntas abiertas).
- [Gasto descontrolado por uso público] → Clave de administrador, límite por IP y tope diario (D10).
- [Alcance demasiado grande para 8 días] → Las tareas marcan lo imprescindible. Si hay atraso se recorta en este orden: estudio citado → índice visual → índice bíblico por Spark (el detector por reglas se queda).
- [SQLite con un solo escritor y trabajos en memoria se pierden al reiniciar] → Aceptable para la demo. El estado de cada video queda en la base, y un trabajo interrumpido se puede relanzar. Deuda registrada arriba.

## Migration Plan

Proyecto nuevo, no hay migración. El despliegue es una aplicación Dokploy con su Dockerfile y un volumen `/data` (base y medios). Para revertir, se vuelve a la imagen anterior; la base vive en el volumen.

## Open Questions

- ¿La iglesia autoriza por escrito usar sus prédicas en la demo pública y en el video? Si no, ¿qué videos con licencia abierta usamos?
- ¿Cuántos videos tendrá la colección de demo? La propuesta es de 3 a 6 prédicas, entre 3 y 6 horas.
- Usuario de GitHub del propietario, para el remoto público.
- Fuente de la tabla del canon: elegir un conjunto de datos con licencia abierta (CC0 o dominio público) y citarlo.
