/**
 * La traza del agente (interfaz-con-volumen): los pasos reales que emite `preguntar` y cómo se
 * agrupan en las cuatro etapas del margen de «Preguntar». Sin dependencias del servidor: la usan
 * el agente, la transmisión y la página.
 */

export type PasoAgente =
	| { tipo: 'herramienta'; herramienta: string; detalle: string; resultados: number }
	| { tipo: 'redactar'; fragmentos: number }
	| { tipo: 'traducir'; idioma: string; citas: number }
	| { tipo: 'verificar'; citas: number; verificadas: number };

export type EstadoEtapa = 'pendiente' | 'activa' | 'hecha' | 'omitida' | 'sin-registro';

export interface Etapa {
	clave: 'buscar' | 'leer' | 'redactar' | 'verificar';
	estado: EstadoEtapa;
	pasos: PasoAgente[];
}

const ORDEN = ['buscar', 'leer', 'redactar', 'verificar'] as const;

/** A qué etapa pertenece un paso. Leer el contexto es «leer»; el resto de herramientas, «buscar». */
export function etapaDe(paso: PasoAgente): Etapa['clave'] {
	// Traducir es parte de escribir la respuesta (Muse Spark), y ocurre antes de anunciar la verificación.
	if (paso.tipo === 'traducir') return 'redactar';
	if (paso.tipo !== 'herramienta') return paso.tipo;
	return paso.herramienta === 'leer_fragmentos' ? 'leer' : 'buscar';
}

/**
 * Agrupa los pasos en las cuatro etapas. Mientras trabaja, la etapa del último paso está activa y
 * las anteriores, hechas (si aún no hay pasos, el modelo está decidiendo qué buscar). Al terminar,
 * una etapa sin pasos queda «omitida»: por ejemplo, sin evidencia no hay nada que redactar.
 * Con una traza incompleta (la de `trazaDeRespuesta`), la ausencia no prueba nada: queda «sin-registro».
 */
export function agruparEtapas(pasos: PasoAgente[], trabajando: boolean, completa = true): Etapa[] {
	const ultima = pasos.length ? ORDEN.indexOf(etapaDe(pasos[pasos.length - 1])) : 0;
	return ORDEN.map((clave, i) => {
		const propios = pasos.filter((p) => etapaDe(p) === clave);
		let estado: EstadoEtapa;
		if (trabajando) estado = i < ultima ? 'hecha' : i === ultima ? 'activa' : 'pendiente';
		else if (pasos.length === 0) estado = 'pendiente';
		else estado = propios.length ? 'hecha' : completa ? 'omitida' : 'sin-registro';
		// Leer es opcional: si el agente pasó de buscar a redactar sin leer, no queda «hecha».
		if (trabajando && estado === 'hecha' && propios.length === 0) estado = 'omitida';
		return { clave, estado, pasos: propios };
	});
}

/** Un paso tal como se muestra: los repetidos de la misma herramienta y detalle, juntos. */
export type PasoMostrado = PasoAgente & { veces: number };

/**
 * Junta los pasos repetidos (la misma herramienta con el mismo detalle, p. ej. ocho lecturas del
 * mismo video) en uno, en la posición del primero, con las veces y los resultados sumados. Si
 * alguno no trae cifra (-1), la suma tampoco: no se inventa.
 */
export function compactarPasos(pasos: PasoAgente[]): PasoMostrado[] {
	const salida: PasoMostrado[] = [];
	const indice = new Map<string, PasoMostrado>();
	for (const paso of pasos) {
		if (paso.tipo !== 'herramienta') {
			salida.push({ ...paso, veces: 1 });
			continue;
		}
		const clave = `${paso.herramienta}\u0000${paso.detalle}`;
		const previo = indice.get(clave);
		if (previo && previo.tipo === 'herramienta') {
			previo.veces++;
			previo.resultados =
				previo.resultados < 0 || paso.resultados < 0 ? -1 : previo.resultados + paso.resultados;
			continue;
		}
		const nuevo: PasoMostrado = { ...paso, veces: 1 };
		indice.set(clave, nuevo);
		salida.push(nuevo);
	}
	return salida;
}

/**
 * La traza de una respuesta que llegó sin transmisión (formulario sin JS o respuesta guardada):
 * solo lo que la respuesta conserva: las consultas, que se redactó y la verificación. Sin cifras que
 * no se saben (-1). Lo que no conserva (qué leyó) se muestra como «sin registro», no como omitido.
 */
export function trazaDeRespuesta(respuesta: {
	busquedas: string[];
	afirmaciones: Array<{ citas: Array<{ estado: string }> }>;
	sinEvidencia: boolean;
}): PasoAgente[] {
	const pasos: PasoAgente[] = respuesta.busquedas.map((consulta) => ({
		tipo: 'herramienta',
		herramienta: 'buscar',
		detalle: consulta,
		resultados: -1
	}));
	if (respuesta.sinEvidencia) return pasos;
	pasos.push({ tipo: 'redactar', fragmentos: -1 });
	const citas = respuesta.afirmaciones.flatMap((a) => a.citas);
	pasos.push({
		tipo: 'verificar',
		citas: citas.length,
		verificadas: citas.filter((c) => c.estado === 'verificada').length
	});
	return pasos;
}
