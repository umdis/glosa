import type { Base } from '../db/base';
import {
	MODELO_RAZONAMIENTO,
	type ClienteMeta,
	type MensajeChat,
	type RespuestaChat
} from '../meta/cliente';
import {
	verificarAfirmaciones,
	type AfirmacionPropuesta,
	type AfirmacionVerificada
} from '../verificacion/verificar';
import type { PasoAgente } from '../../traza';
import { idiomaValido, traducir } from '../traduccion/traducir';
import { DEFINICIONES, ejecutarHerramienta, type FragmentoEvidencia } from './herramientas';

/**
 * Agente investigador (design.md D6), en dos fases:
 * 1. Investiga con herramientas (Chat Completions, el endpoint de Meta que las admite).
 * 2. Redacta la respuesta con salida estructurada usando solo la evidencia que leyó.
 * Después, el servidor verifica cada cita (D7). El modelo nunca escribe minutos.
 */

export interface ResultadoAgente {
	pregunta: string;
	afirmaciones: AfirmacionVerificada[];
	/** El agente no encontró nada en la colección que respalde una respuesta. */
	sinEvidencia: boolean;
	pasos: number;
	busquedas: string[];
	/** Idioma de la pregunta (ISO 639-1), según la redacción. Las citas siguen en el original. */
	idioma?: string;
}

export type { PasoAgente };

export interface OpcionesAgente {
	maximoPasos?: number;
	/** Tope de tokens de entrada acumulados en la fase de investigación. */
	maximoTokens?: number;
	/** Recibe cada paso real en cuanto ocurre (interfaz-con-volumen D2), para dibujarlo en vivo. */
	alPaso?: (paso: PasoAgente) => void;
}

/** La lengua de las prédicas de la colección: lo que no esté en ella se traduce. */
const IDIOMA_COLECCION = 'es';

const INSTRUCCIONES_INVESTIGAR = `You are the research assistant of Glosa, a workspace over a collection of video transcripts (sermons, lectures, talks), mostly in Spanish.
Investigate the user's question using ONLY the tools. Rules:
- Search several times: different words, synonyms, other word forms (criar / crianza / hijos), single keywords. A paraphrase of the question will not match the transcript.
- Before relying on a search result, read its context with leer_fragmentos.
- The transcripts are in Spanish: search with Spanish words even when the question is in another language.
- For Bible questions, also use pasajes.
- Never answer from your own knowledge. If the collection does not talk about it, say so.
- Stop searching when you have enough evidence, then reply with a short note of what you found.`;

const INSTRUCCIONES_RESPONDER = `Write the answer to the question using ONLY the evidence fragments provided.
- Answer in the language of the question, and report that language as an ISO 639-1 code in idioma (en, es, pt...).
- Quotes stay verbatim in the language of the transcript; never translate a quote.
- Each claim must be supported by citations. A citation is the fragment id plus a VERBATIM quote copied from that fragment's text (at least 5 words, exactly as written, no paraphrase, no added words). Quotes may skip filler words like "eh", nothing else.
- Do not include times or minutes anywhere.
- If the evidence does not answer the question, return no claims and set sin_evidencia to true.
- Prefer 2 to 5 claims. Each claim is one sentence.`;

const ESQUEMA_RESPUESTA = {
	type: 'json_schema',
	json_schema: {
		name: 'respuesta_glosa',
		schema: {
			type: 'object',
			properties: {
				sin_evidencia: { type: 'boolean' },
				idioma: { type: 'string' },
				afirmaciones: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							texto: { type: 'string' },
							citas: {
								type: 'array',
								items: {
									type: 'object',
									properties: {
										fragmento_id: { type: 'integer' },
										frase: { type: 'string' }
									},
									required: ['fragmento_id', 'frase'],
									additionalProperties: false
								}
							}
						},
						required: ['texto', 'citas'],
						additionalProperties: false
					}
				}
			},
			required: ['sin_evidencia', 'idioma', 'afirmaciones'],
			additionalProperties: false
		}
	}
};

export async function preguntar(
	db: Base,
	meta: Pick<ClienteMeta, 'chat'>,
	pregunta: string,
	opciones: OpcionesAgente = {}
): Promise<ResultadoAgente> {
	const maximoPasos = opciones.maximoPasos ?? 8;
	const maximoTokens = opciones.maximoTokens ?? 150_000;
	const alPaso = opciones.alPaso ?? (() => {});
	const evidencia = new Map<number, FragmentoEvidencia>();
	const busquedas: string[] = [];
	const mensajes: MensajeChat[] = [
		{ role: 'system', content: INSTRUCCIONES_INVESTIGAR },
		{ role: 'user', content: pregunta }
	];

	// Fase 1: investigar.
	let pasos = 0;
	let tokens = 0;
	while (pasos < maximoPasos && tokens < maximoTokens) {
		pasos++;
		const respuesta: RespuestaChat = await meta.chat(
			{ model: MODELO_RAZONAMIENTO, messages: mensajes, tools: DEFINICIONES },
			'agente_investigar'
		);
		tokens += respuesta.usage?.prompt_tokens ?? 0;
		const mensaje = respuesta.choices[0]?.message;
		const llamadas = mensaje?.tool_calls ?? [];
		if (!mensaje || llamadas.length === 0) break;
		mensajes.push({ role: 'assistant', content: mensaje.content, tool_calls: llamadas });
		for (const llamada of llamadas) {
			let argumentos: Record<string, unknown> = {};
			try {
				argumentos = JSON.parse(llamada.function.arguments || '{}');
			} catch {
				// Argumentos mal formados: la herramienta responde con lo que pueda.
			}
			if (llamada.function.name === 'buscar') busquedas.push(String(argumentos.consulta ?? ''));
			const contenido = ejecutarHerramienta(db, llamada.function.name, argumentos, evidencia);
			mensajes.push({ role: 'tool', tool_call_id: llamada.id, content: contenido });
			alPaso({
				tipo: 'herramienta',
				herramienta: llamada.function.name,
				detalle: detallePaso(llamada.function.name, argumentos, contenido),
				resultados: contarResultados(contenido)
			});
		}
	}

	if (evidencia.size === 0) {
		return { pregunta, afirmaciones: [], sinEvidencia: true, pasos, busquedas };
	}

	// Fase 2: responder solo con la evidencia vista, en salida estructurada.
	alPaso({ tipo: 'redactar', fragmentos: evidencia.size });
	const fragmentos = [...evidencia.values()]
		.map((f) => `[fragmento ${f.fragmento_id}] (${f.video})\n${f.texto}`)
		.join('\n\n');
	const final = await meta.chat(
		{
			model: MODELO_RAZONAMIENTO,
			messages: [
				{ role: 'system', content: INSTRUCCIONES_RESPONDER },
				{ role: 'user', content: `Question: ${pregunta}\n\nEvidence fragments:\n\n${fragmentos}` }
			],
			response_format: ESQUEMA_RESPUESTA
		},
		'agente_responder'
	);

	const propuesta = leerRespuesta(final.choices[0]?.message.content ?? '');
	const afirmaciones = verificarAfirmaciones(db, propuesta.afirmaciones);
	const citas = afirmaciones.flatMap((a) => a.citas);

	// Solo las citas verificadas se traducen, y la traducción es ayuda: si falla, la respuesta sigue.
	const idioma = idiomaValido(propuesta.idioma) ?? IDIOMA_COLECCION;
	if (idioma !== IDIOMA_COLECCION) {
		const verificadas = citas.filter((c) => c.estado === 'verificada');
		try {
			const traducidas = await traducir(
				db,
				meta,
				verificadas.map((c) => c.frase),
				idioma,
				'traducir_citas'
			);
			for (const c of verificadas) c.traduccion = traducidas.get(c.frase);
			alPaso({
				tipo: 'traducir',
				idioma,
				citas: verificadas.filter((c) => c.traduccion).length
			});
		} catch (error) {
			console.error('Falló la traducción de las citas', error);
		}
	}
	alPaso({
		tipo: 'verificar',
		citas: citas.length,
		verificadas: citas.filter((c) => c.estado === 'verificada').length
	});
	return {
		pregunta,
		afirmaciones,
		sinEvidencia: propuesta.sinEvidencia,
		idioma,
		pasos,
		busquedas
	};
}

/** Cuántos elementos devolvió una herramienta: una lista cuenta sus filas; un aviso, cero. */
function contarResultados(contenido: string): number {
	try {
		const datos = JSON.parse(contenido);
		return Array.isArray(datos) ? datos.length : 0;
	} catch {
		return 0;
	}
}

/** Lo que la persona reconoce de cada paso: la consulta, la referencia o el video leído. */
function detallePaso(herramienta: string, argumentos: Record<string, unknown>, contenido: string) {
	if (herramienta === 'buscar') return String(argumentos.consulta ?? '').slice(0, 200);
	if (herramienta === 'pasajes') return String(argumentos.referencia ?? '').slice(0, 200);
	try {
		const datos = JSON.parse(contenido);
		return Array.isArray(datos) && typeof datos[0]?.video === 'string' ? datos[0].video : '';
	} catch {
		return '';
	}
}

/** Convierte la salida JSON del modelo en afirmaciones propuestas, tolerando campos de más. */
export function leerRespuesta(contenido: string): {
	sinEvidencia: boolean;
	idioma?: string;
	afirmaciones: AfirmacionPropuesta[];
} {
	let datos: { sin_evidencia?: unknown; idioma?: unknown; afirmaciones?: unknown };
	try {
		datos = JSON.parse(contenido);
	} catch {
		return { sinEvidencia: true, afirmaciones: [] };
	}
	type Crudo = Record<string, unknown> | null | undefined;
	const lista = (valor: unknown): Crudo[] => (Array.isArray(valor) ? valor : []);
	const afirmaciones = lista(datos.afirmaciones)
		.filter((a) => typeof a?.texto === 'string')
		.map((a) => ({
			texto: a!.texto as string,
			citas: lista(a!.citas)
				.filter((c) => Number.isInteger(c?.fragmento_id) && typeof c?.frase === 'string')
				.map((c) => ({ fragmentoId: c!.fragmento_id as number, frase: c!.frase as string }))
		}));
	return {
		sinEvidencia: datos.sin_evidencia === true || afirmaciones.length === 0,
		idioma: typeof datos.idioma === 'string' ? datos.idioma.toLowerCase() : undefined,
		afirmaciones
	};
}
