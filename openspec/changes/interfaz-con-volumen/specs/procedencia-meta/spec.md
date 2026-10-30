## ADDED Requirements

### Requirement: Cada modelo nombrado donde actúa
La interfaz DEBE (MUST) nombrar el modelo de Meta que produjo cada cosa: Muse Voice Transcribe en la transcripción, Muse Spark en la lectura de la pantalla, en la revisión de privacidad y en las respuestas. Las cifras que acompañen esa mención DEBEN (MUST) salir de la base de datos.

#### Scenario: Colofón de la portada
- **WHEN** se abre la portada con dos videos
- **THEN** el colofón dice cuánto tiempo transcribió Muse Voice, cuántos textos en pantalla leyó Muse Spark y cuántos pasajes se encontraron, con los números reales
