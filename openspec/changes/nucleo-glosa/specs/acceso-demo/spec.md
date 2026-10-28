## ADDED Requirements

### Requirement: Colección pública de solo lectura
El sistema DEBE (MUST) permitir a cualquier visitante buscar, preguntar y ver los videos de la colección pública, sin cuenta, sin poder subir ni modificar nada, y viendo solo el contenido aprobado.

#### Scenario: Visitante anónimo
- **WHEN** un juez abre Glosa sin credenciales
- **THEN** puede buscar y preguntar sobre la colección, y no ve los controles de subida ni de revisión

### Requirement: Clave de administrador
El sistema DEBE (MUST) exigir la clave de administrador para subir videos, revisar pendientes y borrar contenido. La clave vive solo en el servidor.

#### Scenario: Intento sin clave
- **WHEN** alguien llama al endpoint de subida sin la clave correcta
- **THEN** recibe un rechazo y no se procesa nada

### Requirement: Límite de uso y tope de gasto
El sistema DEBE (MUST) limitar las preguntas por visitante y detener las llamadas a la IA cuando el gasto del día, calculado con el uso de tokens que informa la API, alcance el tope configurado. Al alcanzarlo, informa con claridad del motivo.

#### Scenario: Tope diario alcanzado
- **WHEN** el gasto acumulado del día llega al tope
- **THEN** las preguntas nuevas reciben un mensaje que explica que se alcanzó el límite de la demo, y la búsqueda sigue funcionando
