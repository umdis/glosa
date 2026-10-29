## ADDED Requirements

### Requirement: Vincular un video con YouTube
El editor DEBE (MUST) poder indicar, al subir un video o después, el enlace de su publicación en YouTube. Glosa obtiene por oEmbed el título, el canal y la miniatura, y los propone para el video sin sobrescribir lo que el editor ya escribió.

#### Scenario: Pegar el enlace al subir
- **WHEN** el editor pega un enlace de YouTube válido junto al archivo
- **THEN** el título del video se rellena con el de YouTube y queda editable

#### Scenario: Enlace que no es de YouTube
- **WHEN** el enlace no es de youtube.com o youtu.be
- **THEN** se rechaza con el motivo y no se hace ninguna petición

### Requirement: Enlace al original
La página del video y cada cita DEBEN (MUST) ofrecer «Watch on YouTube» que abre la publicación original en el mismo minuto.

#### Scenario: Abrir en YouTube en el minuto
- **WHEN** un visitante pulsa «Watch on YouTube» en una cita del minuto 12:30
- **THEN** se abre YouTube en ese video con `t=750`

### Requirement: Sin descargas desde YouTube
El sistema NO DEBE (MUST NOT) descargar audio ni video de YouTube. El archivo siempre lo sube el editor.

#### Scenario: Solo el enlace
- **WHEN** el editor pega un enlace de YouTube sin subir archivo
- **THEN** se le pide el archivo y no se procesa nada
