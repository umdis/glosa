## ADDED Requirements

### Requirement: Lámina de una cita o de una investigación
El sistema DEBE (MUST) generar una lámina (imagen PNG, cuadrada y vertical) con una ilustración creada por Muse Image a partir del tema, la frase citada, la fuente (video y minuto) y un código QR que abre ese minuto en Glosa. La ilustración se pide sin personas, sin rostros y sin texto, y lleva la mención «Illustration: Muse Image».

#### Scenario: Lámina de una cita
- **WHEN** el usuario pulsa «Make a card» en una cita verificada
- **THEN** recibe la lámina con la ilustración, la frase, la fuente y el QR, lista para descargar

#### Scenario: QR al minuto
- **WHEN** alguien escanea el QR de la lámina
- **THEN** abre el video en Glosa en el minuto de la cita

### Requirement: Portada de investigación
El sistema DEBE (MUST) permitir generar una portada ilustrada para una investigación publicada, que se usa también como imagen al compartirla.

#### Scenario: Compartir una investigación con portada
- **WHEN** se comparte el enlace de lectura de la investigación
- **THEN** la vista previa muestra su portada

### Requirement: Gasto y caché
Cada ilustración DEBE (MUST) contar para el tope de gasto diario, guardarse en caché por cita o investigación, y limitarse por visitante y por día.

#### Scenario: Misma cita dos veces
- **WHEN** se pide otra vez la lámina de una cita que ya la tiene
- **THEN** se devuelve la guardada sin una nueva llamada a Muse Image
