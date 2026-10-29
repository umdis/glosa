import type { Base } from '../db/base';
import { MODELO_RAZONAMIENTO, type ClienteMeta } from '../meta/cliente';
import { crearVerificador } from '../verificacion/verificar';
import { ErrorInvestigacion, LIMITES, anadirCita, anadirTexto, bloquesDe } from './datos';

/**
 * «Draft with Spark» (spec investigaciones; design.md D3 de glosa-competitiva). Spark redacta una
 * sección a partir de las citas del cuaderno y solo puede citar esos fragmentos. Cada cita se
 * verifica contra su fragmento (sin vecinos) y lo que no se verifica se descarta y se cuenta.
 */

export interface ResultadoRedaccion {
	bloques: number;
	citas: number;
	descartadas: number;
}

/** Bloques que puede añadir una redacción, para que un borrador no llene el cuaderno solo. */
const MAXIMO_BLOQUES_BORRADOR = 14;

const INSTRUCCIONES = `You help a pastor or teacher write a study from quotes of sermons and talks.
Write ONE section of the study using ONLY the quotes in the notebook.
- Write in the language of the notebook title and the request.
- Organize the section as an optional heading, then short paragraphs. After a paragraph, cite the quotes that support it.
- A citation is the fragment id plus a VERBATIM excerpt copied from that fragment (at least 5 words, exactly as written). Never cite a fragment that is not in the notebook.
- Do not invent facts, names, Bible references or times. Do not mention minutes.
- 2 to 5 paragraphs. Each paragraph at most 90 words.`;

const ESQUEMA = {
	type: 'json_schema',
	json_schema: {
		name: 'borrador_glosa',
		schema: {
			type: 'object',
			properties: {
				bloques: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							tipo: { type: 'string', enum: ['titulo', 'texto'] },
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
						required: ['tipo', 'texto', 'citas'],
						additionalProperties: false
					}
				}
			},
			required: ['bloques'],
			additionalProperties: false
		}
	}
};

interface BloquePropuesto {
	tipo: 'titulo' | 'texto';
	texto: string;
	citas: Array<{ fragmentoId: number; frase: string }>;
}

/** Lee la salida del modelo tolerando campos de más y descartando lo mal formado. */
export function leerBorrador(contenido: string): BloquePropuesto[] {
	let datos: { bloques?: unknown };
	try {
		datos = JSON.parse(contenido);
	} catch {
		return [];
	}
	if (!Array.isArray(datos.bloques)) return [];
	return datos.bloques.flatMap((b: Record<string, unknown> | null): BloquePropuesto[] => {
		if (!b || (b.tipo !== 'titulo' && b.tipo !== 'texto') || typeof b.texto !== 'string') return [];
		const texto = b.texto.trim();
		if (!texto) return [];
		const citas = (Array.isArray(b.citas) ? b.citas : []).flatMap(
			(c: Record<string, unknown> | null) =>
				c && Number.isInteger(c.fragmento_id) && typeof c.frase === 'string'
					? [{ fragmentoId: c.fragmento_id as number, frase: c.frase }]
					: []
		);
		return [{ tipo: b.tipo, texto, citas }];
	});
}

export async function redactarSeccion(
	db: Base,
	meta: Pick<ClienteMeta, 'chat'>,
	investigacion: { id: string; titulo: string },
	pedido: string
): Promise<ResultadoRedaccion> {
	const citas = bloquesDe(db, investigacion.id).flatMap((b) =>
		b.tipo === 'cita' && b.cita ? [b.cita] : []
	);
	if (citas.length === 0) {
		throw new ErrorInvestigacion('Add at least one quote to the investigation first.');
	}

	// El modelo recibe el texto completo de cada fragmento citado, para que cite de ahí.
	const fragmento = db.prepare(`SELECT texto FROM fragmentos WHERE id = ?`);
	const permitidos = new Map<number, string>();
	for (const c of citas) {
		if (permitidos.has(c.fragmentoId)) continue;
		const fila = fragmento.get(c.fragmentoId) as { texto: string } | undefined;
		if (fila)
			permitidos.set(c.fragmentoId, `[fragmento ${c.fragmentoId}] (${c.titulo})\n${fila.texto}`);
	}

	const respuesta = await meta.chat(
		{
			model: MODELO_RAZONAMIENTO,
			messages: [
				{ role: 'system', content: INSTRUCCIONES },
				{
					role: 'user',
					content: `Notebook title: ${investigacion.titulo}\nRequest: ${pedido || 'Write the next section of the study.'}\n\nNotebook quotes:\n\n${[...permitidos.values()].join('\n\n')}`
				}
			],
			response_format: ESQUEMA
		},
		'investigacion_redactar'
	);

	const propuesta = leerBorrador(respuesta.choices[0]?.message.content ?? '');
	// Sin vecinos: la cita tiene que estar en el fragmento que se nombra, que está en el cuaderno.
	const verificar = crearVerificador(db, { vecinos: 0 });
	let descartadas = 0;
	const bloques: Array<
		| { tipo: 'titulo' | 'texto'; texto: string }
		| { tipo: 'cita'; fragmentoId: number; frase: string }
	> = [];
	for (const b of propuesta) {
		bloques.push({
			tipo: b.tipo,
			texto: b.texto.slice(0, b.tipo === 'titulo' ? LIMITES.titulo : LIMITES.texto)
		});
		for (const c of b.citas) {
			const v = permitidos.has(c.fragmentoId) ? verificar(c) : null;
			if (v?.estado === 'verificada' && permitidos.has(v.fragmentoId)) {
				bloques.push({ tipo: 'cita', fragmentoId: v.fragmentoId, frase: c.frase });
			} else {
				descartadas++;
			}
		}
	}
	const aInsertar = bloques.slice(0, MAXIMO_BLOQUES_BORRADOR);
	if (aInsertar.length === 0) {
		throw new ErrorInvestigacion(
			'Muse Spark did not return a usable draft. Try a more specific request.'
		);
	}

	db.transaction(() => {
		for (const b of aInsertar) {
			if (b.tipo === 'cita') anadirCita(db, investigacion.id, b.fragmentoId, b.frase, true);
			else anadirTexto(db, investigacion.id, b.tipo, b.texto, true);
		}
	})();
	return {
		bloques: aInsertar.filter((b) => b.tipo !== 'cita').length,
		citas: aInsertar.filter((b) => b.tipo === 'cita').length,
		descartadas
	};
}
