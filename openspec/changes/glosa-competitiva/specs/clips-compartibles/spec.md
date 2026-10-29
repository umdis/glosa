## ADDED Requirements

### Requirement: Clip vertical a partir de una cita verificada
El sistema DEBE (MUST) generar, a partir de una cita verificada, un clip MP4 vertical (1080×1920) de entre 15 y 60 s que contiene el momento citado, con subtítulos quemados tomados de la transcripción, el título del video y la dirección de Glosa. El clip se guarda en caché y no se vuelve a generar si ya existe.

#### Scenario: Primer clip de una cita
- **WHEN** el usuario pulsa «Make a clip» en una cita verificada
- **THEN** ve el progreso y, al terminar, el clip con un botón para descargarlo y otro para copiar su enlace

#### Scenario: Clip ya generado
- **WHEN** otra persona pide el clip de la misma cita
- **THEN** recibe el archivo en caché sin volver a procesarlo

### Requirement: Solo contenido visible
El clip NO DEBE (MUST NOT) incluir audio ni subtítulos de fragmentos ocultos. Si la ventana del clip toca un fragmento oculto, se recorta para excluirlo; si no queda un clip de al menos 15 s, se rechaza con el motivo.

#### Scenario: Clip junto a una petición de oración oculta
- **WHEN** la cita está pegada a un bloque oculto de peticiones de oración
- **THEN** el clip termina antes del bloque oculto

### Requirement: Página para compartir
Cada clip DEBE (MUST) tener una página pública con el video, la frase, el enlace al minuto en Glosa y metadatos Open Graph (imagen, video y título) para que se vea al compartir en WhatsApp y redes.

#### Scenario: Compartir por WhatsApp
- **WHEN** alguien pega el enlace del clip en un chat
- **THEN** la vista previa muestra el fotograma, el título y la frase

### Requirement: Límites de proceso
El sistema DEBE (MUST) generar los clips de uno en uno, limitar los clips nuevos por visitante y por día, y rechazar con claridad cuando la cola está llena.

#### Scenario: Cola llena
- **WHEN** hay demasiados clips esperando
- **THEN** el visitante recibe «try again in a minute» y no se encola más
