## ADDED Requirements

### Requirement: Pasos reales del agente
El agente DEBE (MUST) notificar un paso por cada herramienta que ejecuta, con su nombre, su detalle (la consulta, la referencia o el video) y el número de resultados que devolvió. También DEBE (MUST) notificar el comienzo de la redacción y el resultado de la verificación. NO DEBE (MUST NOT) emitirse ningún paso que no haya ocurrido.

#### Scenario: Dos búsquedas y una lectura
- **WHEN** el modelo pide `buscar("tentación")`, `buscar("prueba")` y `leer_fragmentos(12)`
- **THEN** se notifican exactamente esos tres pasos, en ese orden y con los resultados devueltos, y después «redactar» y «verificar»

### Requirement: Traza en vivo en Preguntar
Con JavaScript, `/ask` DEBE (MUST) mostrar cada paso al llegar, en una región `role="log"`, nombrando a Muse Spark en la investigación y la redacción, y al servidor de Glosa en la verificación. Sin JavaScript, la pregunta DEBE (MUST) seguir respondiéndose por POST, y el margen se arma a partir de la respuesta.

#### Scenario: Pregunta con JavaScript
- **WHEN** la persona pregunta
- **THEN** las búsquedas aparecen una a una mientras el agente trabaja, y al final la respuesta queda con el margen completo

#### Scenario: Movimiento reducido
- **WHEN** la persona pide menos movimiento
- **THEN** los pasos aparecen sin animación
