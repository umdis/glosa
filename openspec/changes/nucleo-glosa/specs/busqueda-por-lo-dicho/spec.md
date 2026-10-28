## ADDED Requirements

### Requirement: Búsqueda en toda la colección
El sistema DEBE (MUST) buscar una frase o unas palabras en las transcripciones de todos los videos visibles. Ignora mayúsculas y tildes, y devuelve cada coincidencia con su video, su momento y el texto que la rodea.

#### Scenario: Búsqueda sin tildes
- **WHEN** el usuario busca «tentacion»
- **THEN** obtiene los fragmentos que dicen «tentación», ordenados por relevancia, cada uno con el video y el minuto

#### Scenario: Otra forma de la misma palabra
- **WHEN** el usuario busca «tentaciones»
- **THEN** también obtiene los fragmentos que dicen «tentación», con la palabra dicha resaltada tal como aparece en la transcripción

#### Scenario: Sin resultados
- **WHEN** la búsqueda no coincide con nada
- **THEN** el sistema lo dice claramente y sugiere reformular la búsqueda o preguntarle al agente

### Requirement: Salto al momento exacto
El sistema DEBE (MUST) abrir el reproductor en el inicio del fragmento elegido y resaltar ese fragmento en la transcripción sincronizada.

#### Scenario: Clic en un resultado
- **WHEN** el usuario elige un resultado
- **THEN** el video empieza a sonar en el momento del fragmento y la transcripción se desplaza hasta él

### Requirement: Navegable con teclado
La búsqueda, la lista de resultados y el reproductor DEBEN (MUST) poder usarse solo con teclado y foco visible, cumpliendo WCAG 2.2 AA.

#### Scenario: Usuario sin ratón
- **WHEN** el usuario busca y recorre los resultados solo con el teclado
- **THEN** puede abrir cualquier resultado y controlar la reproducción sin usar el ratón
