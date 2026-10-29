## ADDED Requirements

### Requirement: Difuminar al público con SAM 3.1
Cuando la privacidad visual está activa, el sistema DEBE (MUST) segmentar con SAM 3.1 a las personas de cada fotograma, clip y lámina que se publique, y difuminar a todas salvo a la persona que habla (el predicador), que se identifica como la persona más grande y estable en el plano. Si SAM falla, el sistema no publica la imagen sin difuminar: muestra el minuto como respaldo.

#### Scenario: Fotograma con congregación
- **WHEN** un fotograma muestra al predicador y a personas sentadas
- **THEN** las personas sentadas salen difuminadas y el predicador nítido

#### Scenario: SAM no responde
- **WHEN** la llamada a SAM falla o se alcanza el tope de gasto
- **THEN** no se sirve el fotograma original; se muestra el minuto en su lugar

### Requirement: Control del editor
El editor DEBE (MUST) poder activar o desactivar la privacidad visual por video desde `/admin`, y ver una comparación antes y después en un fotograma de muestra.

#### Scenario: Revisar el difuminado
- **WHEN** el editor abre la vista previa de un video
- **THEN** ve el mismo fotograma original y difuminado, solo él

### Requirement: Caché y gasto
Las máscaras y las imágenes difuminadas DEBEN (MUST) guardarse en caché y su coste contar para el tope de gasto diario.

#### Scenario: Fotograma ya difuminado
- **WHEN** se vuelve a pedir un fotograma ya procesado
- **THEN** se sirve el difuminado guardado sin llamar a SAM
