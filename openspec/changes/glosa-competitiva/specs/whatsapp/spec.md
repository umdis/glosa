## ADDED Requirements

### Requirement: Preguntar por WhatsApp
El sistema DEBE (MUST) recibir los mensajes de texto que lleguen al número de WhatsApp de Glosa, pasarlos al agente y responder con la respuesta resumida y sus citas verificadas, cada una con el enlace al minuto en Glosa. Responde en el idioma de la pregunta.

#### Scenario: Pregunta por WhatsApp
- **WHEN** alguien escribe «¿Qué se dijo sobre criar hijos?» al número de Glosa
- **THEN** recibe un mensaje con la respuesta y hasta tres citas, cada una con su minuto y enlace

#### Scenario: Mensaje que no es texto
- **WHEN** llega una imagen, un audio u otro tipo de mensaje
- **THEN** se responde que por ahora solo se aceptan preguntas escritas

### Requirement: Webhook seguro
El webhook DEBE (MUST) responder al reto de verificación de Meta solo con el token de verificación configurado y rechazar todo evento cuya firma `X-Hub-Signature-256` no coincida con el secreto de la app.

#### Scenario: Evento con firma falsa
- **WHEN** llega un POST sin firma válida
- **THEN** se rechaza con 401 y no se llama al agente

### Requirement: Datos mínimos y límites
El sistema DEBE (MUST) guardar del remitente solo un identificador cifrado de un solo sentido para aplicar límites, no guardar el texto de las conversaciones más allá de responder, limitar las preguntas por número y por día, y respetar el tope de gasto diario. Solo responde a quien escribe; nunca inicia conversaciones.

#### Scenario: Límite por número
- **WHEN** un número supera las preguntas del día
- **THEN** recibe un aviso del límite y no se llama al agente
