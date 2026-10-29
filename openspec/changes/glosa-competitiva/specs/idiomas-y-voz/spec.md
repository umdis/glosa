## ADDED Requirements

### Requirement: Preguntar en otro idioma
El sistema DEBE (MUST) aceptar preguntas en un idioma distinto al de los videos. El agente busca en el idioma de la colección y responde en el idioma de la pregunta. Cada cita muestra la frase original verificada y, debajo, su traducción marcada como «Translation by Muse Spark»; la verificación se hace siempre contra el original.

#### Scenario: Pregunta en inglés sobre prédicas en español
- **WHEN** un juez pregunta «What was said about forgiveness in the family?»
- **THEN** recibe la respuesta en inglés con citas en español verificadas y su traducción al inglés

#### Scenario: Traducción que cambia el sentido
- **WHEN** la traducción no corresponde a la cita
- **THEN** la cita original sigue siendo la única que cuenta como evidencia y la traducción se presenta como ayuda, nunca como cita

### Requirement: Subtítulos traducidos
El sistema DEBE (MUST) permitir al editor generar subtítulos en inglés de un video, traduciendo los fragmentos visibles con sus mismos tiempos. El reproductor ofrece la pista en inglés además de la original.

#### Scenario: Elegir subtítulos en inglés
- **WHEN** un visitante activa la pista «English» en el reproductor
- **THEN** ve los subtítulos traducidos sincronizados con los mismos minutos

### Requirement: Pregunta por voz
El sistema DEBE (MUST) permitir dictar la pregunta con el micrófono: el audio se transcribe con Muse Voice Transcribe y el texto queda en el campo para que la persona lo revise antes de enviarlo. La grabación tiene un máximo de 30 s, se puede detener con el teclado, anuncia su estado a los lectores de pantalla y no guarda el audio.

#### Scenario: Dictar una pregunta
- **WHEN** el usuario pulsa «Ask by voice», habla y detiene la grabación
- **THEN** el texto transcrito aparece en el campo de pregunta y la pregunta no se envía sola

#### Scenario: Sin permiso de micrófono
- **WHEN** el navegador niega el micrófono
- **THEN** se explica cómo habilitarlo y el campo de texto sigue disponible
