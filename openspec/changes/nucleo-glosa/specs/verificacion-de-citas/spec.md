## ADDED Requirements

### Requirement: Verificación de cada cita
El sistema DEBE (MUST) comprobar cada cita del agente contra el texto del fragmento citado y de sus vecinos inmediatos. Para compararlas, normaliza mayúsculas, tildes y puntuación, y exige una coincidencia en orden igual o superior al umbral configurado (85 % por defecto).

#### Scenario: Cita textual correcta
- **WHEN** la frase citada está en el fragmento indicado
- **THEN** la cita queda `verificada` y su minuto es el inicio del fragmento donde está la frase

#### Scenario: Cita en el fragmento vecino
- **WHEN** la frase citada está en el fragmento siguiente al indicado
- **THEN** la cita queda `verificada` y anclada al fragmento donde realmente está

#### Scenario: Cita inventada
- **WHEN** la frase citada no aparece en el fragmento ni en sus vecinos
- **THEN** la cita queda `no verificada`, no se ofrece como respaldo y se muestra marcada

### Requirement: Afirmaciones sin respaldo
El sistema DEBE (MUST) marcar como `sin respaldo` toda afirmación que no tenga al menos una cita verificada, y distinguirla visualmente de las respaldadas.

#### Scenario: Ninguna cita verificada
- **WHEN** todas las citas de una afirmación fallan la verificación
- **THEN** la afirmación se muestra marcada como sin respaldo, con texto además de color

### Requirement: Minutos solo de la transcripción
El sistema DEBE (MUST) tomar todo minuto que muestre en las citas de lo hablado de la transcripción, nunca de una estimación del modelo.

#### Scenario: El modelo propone un minuto
- **WHEN** la salida del modelo incluye un minuto para algo que se dijo
- **THEN** el sistema descarta ese minuto y usa el del fragmento verificado
