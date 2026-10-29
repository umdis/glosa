## ADDED Requirements

### Requirement: Crear una investigación sin cuenta
El sistema DEBE (MUST) permitir a cualquier visitante crear una investigación con título. Al crearla recibe un enlace privado de edición (con un secreto largo e imposible de adivinar) que es la única forma de modificarla. La página avisa con claridad que quien pierda el enlace pierde la edición.

#### Scenario: Visitante crea una investigación
- **WHEN** un visitante crea una investigación llamada «Familia y perdón»
- **THEN** se abre su página de edición con un enlace privado copiable y el aviso de guardarlo

#### Scenario: Enlace sin secreto
- **WHEN** alguien abre la investigación sin el secreto de edición
- **THEN** no ve controles de edición y, si no está publicada, recibe 404

### Requirement: Bloques ordenables
Una investigación DEBE (MUST) estar formada por bloques de tipo título, texto, cita y nota. Los bloques se pueden añadir, editar, borrar y reordenar, también solo con el teclado (botones «subir» y «bajar», sin depender de arrastrar).

#### Scenario: Reordenar con teclado
- **WHEN** el usuario enfoca un bloque y activa «Move up»
- **THEN** el bloque sube una posición, el foco lo sigue y un lector de pantalla anuncia la nueva posición

### Requirement: Añadir citas verificadas desde cualquier pantalla
El sistema DEBE (MUST) permitir añadir a una investigación una cita verificada desde «Preguntar», desde la búsqueda y desde el video. El bloque de cita guarda el fragmento, el video y el minuto, y solo admite fragmentos visibles.

#### Scenario: Guardar una cita de una respuesta
- **WHEN** el usuario pulsa «Add to investigation» en una cita verificada de una respuesta
- **THEN** la cita aparece al final de la investigación elegida con su frase, video, minuto y enlace

#### Scenario: Fragmento que deja de ser visible
- **WHEN** el editor oculta un fragmento que estaba citado en una investigación
- **THEN** la cita se muestra como retirada, sin el texto, y no se exporta

### Requirement: Redacción asistida que solo cita el cuaderno
El sistema DEBE (MUST) ofrecer «Draft with Spark» para redactar una sección a partir de las citas de la investigación. El modelo solo puede citar fragmentos que ya están en la investigación; cada cita del borrador se verifica antes de mostrarse y lo que no se verifique se descarta. El borrador se inserta como bloques editables marcados como redactados con IA.

#### Scenario: Borrador con una cita inventada
- **WHEN** el modelo devuelve una cita que no coincide con ningún fragmento del cuaderno
- **THEN** esa cita no se inserta y el usuario ve cuántas se descartaron

### Requirement: Publicar y exportar
El sistema DEBE (MUST) permitir publicar la investigación con un enlace de solo lectura y exportarla a Markdown, a Word (.docx) y a una vista imprimible (PDF desde el navegador). En todos los formatos cada cita lleva su frase, el video, el minuto y el enlace a ese momento.

#### Scenario: Exportar a Word
- **WHEN** el usuario exporta a Word
- **THEN** descarga un .docx con títulos, textos y citas, cada cita con un hipervínculo al minuto

### Requirement: Límites
El sistema DEBE (MUST) limitar las investigaciones creadas por visitante y por día, los bloques por investigación y las redacciones con Spark, que cuentan para el tope de gasto diario.

#### Scenario: Tope de redacciones
- **WHEN** se alcanza el tope de gasto del día
- **THEN** «Draft with Spark» se desactiva con el motivo, y el resto de la investigación sigue funcionando
