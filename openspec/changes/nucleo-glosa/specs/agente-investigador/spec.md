## ADDED Requirements

### Requirement: Preguntas a la colección
El sistema DEBE (MUST) responder preguntas en lenguaje natural sobre la colección mediante un agente (`muse-spark-1.3`). El agente usa herramientas: buscar en las transcripciones, leer fragmentos, consultar lo que hubo en pantalla y consultar pasajes bíblicos.

#### Scenario: Pregunta que requiere varias búsquedas
- **WHEN** el usuario pregunta algo que se dijo con otras palabras en varios videos
- **THEN** el agente lanza varias búsquedas, lee los fragmentos pertinentes y responde reuniendo lo que dicen todos

### Requirement: Respuesta estructurada en afirmaciones con citas
El agente DEBE (MUST) entregar la respuesta como una lista de afirmaciones. Cada afirmación lleva sus citas, y cada cita se compone de un identificador de fragmento y la frase textual. El agente no escribe minutos: los pone el sistema.

#### Scenario: Respuesta con evidencia
- **WHEN** el agente termina de responder
- **THEN** cada afirmación muestra sus citas con video, minuto y frase, y un enlace que abre el momento

### Requirement: Límites del agente
El agente DEBE (MUST) detenerse tras un número máximo de pasos y de tokens por pregunta. Si no encuentra respaldo, lo dice en vez de inventar.

#### Scenario: Pregunta sin respuesta en la colección
- **WHEN** la colección no contiene información sobre lo preguntado
- **THEN** el agente responde que no encontró respaldo en los videos y no presenta afirmaciones como respaldadas

### Requirement: Respeto de los segmentos pendientes
El agente DEBE (MUST) ignorar los fragmentos marcados como sensibles que aún no han sido aprobados.

#### Scenario: Petición de oración pendiente de revisión
- **WHEN** una pregunta coincide con un fragmento sensible pendiente
- **THEN** el agente no lo lee ni lo cita
