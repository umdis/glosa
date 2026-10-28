## ADDED Requirements

### Requirement: Subida de video
El sistema DEBE (MUST) permitir a un administrador subir un archivo de video y aceptarlo cualquiera sea su códec (H.264, AV1, VP9). Antes de procesarlo, lo normaliza a H.264.

#### Scenario: Video en AV1 aceptado
- **WHEN** el administrador sube un mp4 con video AV1 y audio Opus
- **THEN** el sistema lo acepta, lo registra con estado `procesando` y lo normaliza sin pedir nada más

#### Scenario: Archivo que no es video
- **WHEN** se sube un archivo sin pista de video ni de audio legible
- **THEN** el sistema lo rechaza con un mensaje que dice qué falló, y no crea el video

### Requirement: Transcripción con marcas de tiempo finas
El sistema DEBE (MUST) transcribir el audio con `muse-voice-transcribe-1.0` en ventanas solapadas. Cada fragmento de la transcripción guarda su inicio y fin absolutos en milisegundos, y ningún fragmento dura más de 20 segundos.

#### Scenario: Pasaje leído de corrido
- **WHEN** el orador lee sin pausa durante más de 2 minutos
- **THEN** la transcripción queda partida en fragmentos de 20 s o menos, cada uno con su minuto real

#### Scenario: Palabra cortada en el borde de una ventana
- **WHEN** una palabra cae justo en el límite entre dos ventanas
- **THEN** la palabra aparece una sola vez en la transcripción final

### Requirement: Índice de lo que aparece en pantalla
El sistema DEBE (MUST) registrar, con su momento, los textos visibles en pantalla (diapositivas, pizarra, versículos) que detecte `muse-spark-1.3` analizando el video en tramos de 10 minutos como máximo.

#### Scenario: Pizarra que se va completando
- **WHEN** una pizarra aparece en pantalla y se le agregan puntos en distintos momentos
- **THEN** el índice guarda cada versión del texto con el momento en que aparece

### Requirement: Estado visible del procesamiento
El sistema DEBE (MUST) mostrar el estado de cada video (`procesando`, `listo`, `con errores`) con el paso en que va. Si falla una parte, conserva lo que sí se procesó.

#### Scenario: Falla el índice visual
- **WHEN** la transcripción termina bien pero falla el análisis visual
- **THEN** el video queda buscable por lo dicho, marcado `con errores`, con la opción de reintentar solo el paso fallido

### Requirement: Archivos temporales en Meta
El sistema DEBE (MUST) subir los tramos de video a la Files API con caducidad y borrarlos en cuanto termine su análisis.

#### Scenario: Análisis terminado
- **WHEN** termina el análisis visual de un tramo
- **THEN** el archivo de ese tramo se borra de la Files API
