## ADDED Requirements

### Requirement: Cuadro de un momento
El sistema DEBE (MUST) servir el cuadro del video en un segundo dado, en JPEG, a 320 o 640 px de ancho. Si el segundo pasa de la duración, se ajusta al último segundo del video.

#### Scenario: Cuadro de una cita
- **WHEN** se pide el fotograma del segundo 383 de un video público, a 320 px
- **THEN** responde un JPEG de 320 px de ancho con el cuadro de ese momento

#### Scenario: Segundo fuera del video
- **WHEN** se pide el segundo 99999 de un video de 43 minutos
- **THEN** responde el cuadro del último segundo del video

### Requirement: Solo videos públicos
El sistema DEBE (MUST) responder 404 a los fotogramas de videos que no son públicos y a cualquier fotograma cuando `SHOW_FRAMES` está apagado.

#### Scenario: Video en revisión
- **WHEN** se pide un fotograma de un video que aún no está aprobado
- **THEN** responde 404 y no se ejecuta ffmpeg

#### Scenario: Fotogramas apagados
- **WHEN** el servidor arranca con `SHOW_FRAMES=false`
- **THEN** toda petición de fotograma responde 404, y la interfaz muestra el marcador tipográfico en su lugar

### Requirement: Caché en disco
El sistema DEBE (MUST) guardar cada fotograma generado junto a los medios del video y servirlo desde ahí las veces siguientes. Las peticiones simultáneas por el mismo cuadro DEBEN (MUST) generar un solo proceso de ffmpeg, y nunca se sirve un archivo a medio escribir.

#### Scenario: Segunda petición
- **WHEN** se pide dos veces el mismo fotograma
- **THEN** la segunda respuesta sale del disco sin ejecutar ffmpeg

#### Scenario: Borrar el video
- **WHEN** el administrador borra un video
- **THEN** sus fotogramas desaparecen con su carpeta de medios
