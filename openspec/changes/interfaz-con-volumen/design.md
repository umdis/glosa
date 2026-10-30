## Brief

- **Personalidad:** un scriptorium que trabaja delante de ti. Sobrio, con autoridad y vivo.
- **Gesto firma:** el margen del escriba, donde se ve el trabajo del agente. Es el único lugar con
  movimiento orquestado; lo demás queda quieto.
- **Volumen:** una lámina de tinta (`--lamina`) como superficie protagonista de la portada; el
  carmín más presente solo donde hay algo verificado o en curso.
- **Descartado por genérico:** degradados, vidrio, rótulos en mayúsculas, número grande con
  etiqueta y fundidos por sección.

## Decisiones

- **D1 Transmisión NDJSON** (`POST /ask/stream`), no SSE ni WebSocket: un `fetch` con
  `ReadableStream` basta, va por el mismo proxy y no deja conexiones abiertas. El POST con JSON no
  lo puede disparar un formulario de otro sitio (CORS), y la acción del formulario sigue para el
  camino sin JS.
- **D2 Los pasos salen del bucle real** (`alPaso` en `preguntar`). Se emite un paso por cada
  herramienta ejecutada, con el número de resultados que devolvió de verdad. Hay una prueba que
  compara los pasos con las llamadas. Nunca hay progreso simulado.
- **D3 Límites compartidos:** la validación, el limitador, el tope de gasto y la respuesta guardada
  pasan a `atender.ts`, que usan la acción y la transmisión, para que no diverjan.
- **D4 Desde la portada, preguntar navega a `/ask?q=`**, con estado de navegación para empezar solo
  si lo pidió un clic con JS. Un GET nunca dispara una pregunta: un rastreador no gasta API.
- **D5 Espécimen por regla:** un pasaje dicho con versículo cuyo fragmento contiene «dice», con
  menos muletillas y más largo. Si ninguno cumple, el primero.
- **D6 Mapa de momentos:** es una ayuda visual con enlaces `tabindex=-1` y `aria-hidden`. La lista
  «In this video» es el camino equivalente con teclado y lector (WCAG 2.5.8, excepción de
  equivalente).
