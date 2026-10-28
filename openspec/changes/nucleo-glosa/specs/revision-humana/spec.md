## ADDED Requirements

### Requirement: Propuestas de la IA pendientes de aprobación
El sistema DEBE (MUST) guardar como `pendientes` los resúmenes y temas que propone la IA, y mostrarlos al público solo después de que un administrador los apruebe o los edite.

#### Scenario: Resumen propuesto
- **WHEN** termina el procesamiento de un video
- **THEN** su resumen aparece en la cola de revisión y no en la vista pública hasta su aprobación

### Requirement: Detección de segmentos sensibles de terceros
El sistema DEBE (MUST) marcar como sensibles los fragmentos que mencionen la salud, la muerte o datos de personas privadas identificables, como las peticiones de oración, y excluirlos de la búsqueda pública y del agente mientras estén pendientes.

#### Scenario: Peticiones de oración al final del culto
- **WHEN** un video termina con peticiones por enfermos con nombre propio
- **THEN** esos fragmentos quedan pendientes, no aparecen en las búsquedas públicas y el agente no los usa

### Requirement: Decisión del administrador
El sistema DEBE (MUST) permitir al administrador aprobar u ocultar cada elemento pendiente, y DEBE (MUST) registrar quién lo decidió y cuándo.

#### Scenario: Ocultar un segmento
- **WHEN** el administrador oculta un fragmento sensible
- **THEN** el fragmento queda fuera de la transcripción pública, de la búsqueda y del agente, y la decisión queda registrada
