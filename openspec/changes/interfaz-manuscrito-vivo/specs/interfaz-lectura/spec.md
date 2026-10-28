## ADDED Requirements

### Requirement: Sistema visual accesible
La interfaz DEBE (MUST) usar una sola familia de tokens (superficies, sombras, radios, espaciado y movimiento) en ambos temas. Todo texto DEBE (MUST) tener un contraste de al menos 4,5:1, y los bordes de control y el foco, de al menos 3:1, medidos por una prueba automática. El carmín DEBE (MUST) reservarse para momentos y referencias verificables, y nunca ser la única señal.

#### Scenario: Prueba de contraste
- **WHEN** se ejecuta `npm test`
- **THEN** la prueba de contraste comprueba cada pareja de tokens de texto y de control en tema claro y oscuro, y falla si alguna no llega al mínimo

### Requirement: Cabecera con búsqueda rápida
La cabecera DEBE (MUST) quedarse visible al desplazarse sin tapar el elemento con foco. La tecla `/` DEBE (MUST) enfocar la búsqueda, salvo mientras se escribe en otro campo.

#### Scenario: Atajo de búsqueda
- **WHEN** la persona pulsa `/` mientras lee una transcripción
- **THEN** el foco pasa al campo de búsqueda de la cabecera

#### Scenario: Escribiendo una pregunta
- **WHEN** la persona escribe «/» dentro del campo de pregunta
- **THEN** el carácter se escribe y el foco no se mueve

### Requirement: Portada que enseña el producto
La portada DEBE (MUST) mostrar un momento real de la colección con su glosa (referencia verificada, minuto y fotograma), cifras reales de la colección y la lista de videos con su póster. Las sugerencias de búsqueda DEBEN (MUST) salir de los temas aprobados de la colección.

#### Scenario: Colección con pasajes
- **WHEN** la colección tiene al menos un pasaje indexado
- **THEN** la portada muestra la frase de ese momento con la glosa al margen, y el minuto lleva al video en ese punto

#### Scenario: Colección vacía
- **WHEN** no hay videos públicos
- **THEN** la portada no muestra espécimen ni cifras en cero, y explica cómo se añade el primer video

### Requirement: Glosas en el margen del video
La página de video DEBE (MUST) mostrar lo que salió en pantalla y los pasajes dichos como glosas junto al fragmento al que pertenecen: en el margen en pantallas anchas y debajo del fragmento en las estrechas. El orden de lectura lineal DEBE (MUST) seguir siendo fragmento y luego su glosa.

#### Scenario: Pasaje dicho
- **WHEN** en el fragmento de 06:23 se cita Santiago 1:2
- **THEN** junto a ese fragmento aparece la glosa «Santiago 1:2» con su minuto, que salta al video

### Requirement: Volver a lo que suena
Con el seguimiento activo, si la persona se aleja del fragmento que suena, la página DEBE (MUST) ofrecer un botón «Back to what's playing» que lleva el foco y la vista a ese fragmento.

#### Scenario: Leer adelante
- **WHEN** el video suena en 10:00 y la persona baja con la rueda hasta 25:00
- **THEN** aparece el botón y, al pulsarlo, la vista vuelve al fragmento de 10:00

### Requirement: Buscar dentro del video
La página de video DEBE (MUST) permitir buscar una palabra en su transcripción, resaltar las coincidencias, recorrerlas con siguiente/anterior y anunciar «n de m».

#### Scenario: Palabra repetida
- **WHEN** la persona busca «tentación» en un video donde aparece 12 veces
- **THEN** la vista va a la primera coincidencia y se anuncia «1 of 12»

### Requirement: Citas como glosas en las respuestas
En «Preguntar», cada cita DEBE (MUST) mostrarse unida a su afirmación (con un trazo en pantallas anchas y con un filete en las estrechas), con la frase, el sello de verificada, el minuto y su fotograma. La espera DEBE (MUST) mostrar un estado de carga honesto, sin pasos simulados.

#### Scenario: Respuesta con dos citas
- **WHEN** una afirmación tiene dos citas verificadas
- **THEN** se ven dos glosas unidas a esa afirmación, cada una con su minuto en carmín y su fotograma

### Requirement: Movimiento con sentido
Las animaciones DEBEN (MUST) limitarse al trazo de la glosa, al sello, a la respuesta a acciones de la persona y a las transiciones entre páginas, y DEBEN (MUST) desaparecer con `prefers-reduced-motion: reduce`.

#### Scenario: Movimiento reducido
- **WHEN** el sistema pide movimiento reducido
- **THEN** el trazo aparece ya dibujado, no hay transición entre páginas y el seguimiento de la transcripción salta sin animar
