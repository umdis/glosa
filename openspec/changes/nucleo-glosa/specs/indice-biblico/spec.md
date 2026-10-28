## ADDED Requirements

### Requirement: Detección de pasajes dichos
El sistema DEBE (MUST) detectar en la transcripción las referencias bíblicas en español, aunque vengan repartidas en fragmentos vecinos. Reconoce variantes de los nombres de libros y formas como «capítulo N versículo M» y «N:M».

#### Scenario: Cita repartida en varios fragmentos
- **WHEN** el orador dice «Santiago capítulo uno» y unos segundos después «en el versículo dos dice»
- **THEN** el índice registra Santiago 1:2 en el momento en que empieza la referencia

### Requirement: Pasajes mostrados en pantalla
El sistema DEBE (MUST) incluir en el índice los pasajes que aparecen en pantalla, con su momento y el origen `en pantalla`.

#### Scenario: Diapositiva con referencias
- **WHEN** una diapositiva muestra «Deuteronomio 6:6-9; 11:18-20»
- **THEN** el índice registra los dos pasajes con el momento de la diapositiva

### Requirement: Validación contra el canon
El sistema DEBE (MUST) validar cada referencia contra una tabla del canon (libros, número de capítulos y de versículos por capítulo) y descartar las imposibles.

#### Scenario: Referencia imposible
- **WHEN** el detector o el modelo proponen «Santiago 9:4» (Santiago tiene 5 capítulos)
- **THEN** la referencia se descarta y no aparece en el índice

### Requirement: Navegación por pasaje
El sistema DEBE (MUST) listar los pasajes de la colección agrupados por libro y, para cada uno, los momentos de todos los videos donde se citan.

#### Scenario: Buscar dónde se predicó un pasaje
- **WHEN** el usuario elige Filipenses 4:8
- **THEN** ve todos los momentos de la colección donde se cita, y cada uno abre el video en ese punto
