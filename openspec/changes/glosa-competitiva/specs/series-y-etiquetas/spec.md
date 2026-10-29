## ADDED Requirements

### Requirement: Series de videos
El editor DEBE (MUST) poder crear series con nombre y descripción y asignarles videos (un video puede estar en varias series). Cada serie tiene una página pública con sus videos en orden.

#### Scenario: Crear una serie
- **WHEN** el editor crea la serie «Familia» con dos videos
- **THEN** la serie aparece en la portada y en `/series` con esos dos videos

### Requirement: Preguntar dentro de una serie
El sistema DEBE (MUST) permitir acotar una pregunta a una serie: las herramientas del agente solo devuelven fragmentos de los videos de esa serie y las citas de otros videos se rechazan.

#### Scenario: Pregunta acotada
- **WHEN** un visitante pregunta desde la página de la serie «Familia»
- **THEN** todas las citas de la respuesta son de videos de esa serie

### Requirement: Resumen compilado de la serie
El editor DEBE (MUST) poder generar con Spark un resumen de la serie a partir de las fichas aprobadas de sus videos. El resumen nace pendiente y solo se publica cuando el editor lo aprueba.

#### Scenario: Resumen pendiente
- **WHEN** se genera el resumen de una serie
- **THEN** aparece en la cola de revisión y no es visible al público hasta aprobarlo

### Requirement: Etiquetas navegables
Los temas aprobados de las fichas DEBEN (MUST) funcionar como etiquetas: una página `/topics` con todas las etiquetas y sus videos, y un filtro por etiqueta en la búsqueda. El editor puede fusionar etiquetas equivalentes.

#### Scenario: Filtrar por etiqueta
- **WHEN** un visitante elige la etiqueta «perdón» en la búsqueda
- **THEN** solo ve resultados de los videos con esa etiqueta
