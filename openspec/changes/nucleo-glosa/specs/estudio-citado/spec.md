## ADDED Requirements

### Requirement: Borrador de estudio con citas
El sistema DEBE (MUST) generar, a partir de un tema o de una respuesta del agente, un borrador de estudio en el que cada cita apunta a un momento verificado del video.

#### Scenario: Estudio a partir de una respuesta
- **WHEN** el usuario pide convertir una respuesta en estudio
- **THEN** se crea un borrador con las afirmaciones verificadas y sus citas, sin incluir las marcadas sin respaldo

### Requirement: Edición y exportación
El sistema DEBE (MUST) permitir editar el texto del estudio y exportarlo a Markdown y a una vista imprimible (PDF desde el navegador). Las citas quedan como enlaces al momento del video.

#### Scenario: Exportar a Markdown
- **WHEN** el usuario exporta el estudio
- **THEN** descarga un archivo Markdown donde cada cita incluye la frase, el video, el minuto y el enlace a ese momento
