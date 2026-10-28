import { olvidarRespuestas } from '../agente/limites';
import type { Base } from '../db/base';
import { MODELO_RAZONAMIENTO, type ClienteMeta } from '../meta/cliente';

/**
 * Segmentos sensibles de terceros (design.md D9). Las prédicas incluyen peticiones de oración
 * por enfermos, operados y fallecidos con nombre propio: datos de personas que no están ahí para
 * consentir. Muse Spark los señala, y quedan pendientes de una decisión humana.
 */

export const CATEGORIAS = ['salud', 'fallecimiento', 'menores', 'persona_privada'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export interface Marcado {
	fragmentoId: number;
	categoria: Categoria;
	motivo: string;
}

const INSTRUCCIONES = `You review transcript fragments of a video (usually a church service in Spanish) before they are published in a searchable archive.
Flag ONLY fragments that expose sensitive information about identifiable private individuals who did not choose to be public:
- salud: the health, illness, surgery or diagnosis of a named or identifiable private person (prayer requests for the sick).
- fallecimiento: the death or mourning of a named or identifiable private person or their family.
- menores: a minor who is named or identifiable.
- persona_privada: other personal situations of a named or identifiable private person (family conflicts, finances, legal problems, confessions).
Do NOT flag: biblical characters, historical or public figures (e.g. Martín Lutero), the speaker talking about people in general, or generic teaching about illness, death or sin.
Prayer requests come in blocks: flag every fragment of the block, including the ones that only introduce or close it while naming people ("let us pray for the family of X", "and for X and all these people").
When in doubt about a named private person, flag it. Write motivo in Spanish, in a few words, without repeating names.`;

const ESQUEMA = {
	type: 'json_schema',
	json_schema: {
		name: 'segmentos_sensibles',
		schema: {
			type: 'object',
			properties: {
				marcados: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							fragmento_id: { type: 'integer' },
							categoria: { type: 'string', enum: [...CATEGORIAS] },
							motivo: { type: 'string' }
						},
						required: ['fragmento_id', 'categoria', 'motivo'],
						additionalProperties: false
					}
				}
			},
			required: ['marcados'],
			additionalProperties: false
		}
	}
};

/** Pide a Muse Spark los fragmentos sensibles. Solo admite ids que existen en la entrada. */
export async function clasificarSensibles(
	meta: Pick<ClienteMeta, 'chat'>,
	fragmentos: Array<{ id: number; texto: string }>
): Promise<Marcado[]> {
	if (fragmentos.length === 0) return [];
	const texto = fragmentos.map((f) => `[${f.id}] ${f.texto}`).join('\n');
	const respuesta = await meta.chat(
		{
			model: MODELO_RAZONAMIENTO,
			messages: [
				{ role: 'system', content: INSTRUCCIONES },
				{ role: 'user', content: `Fragments (id in brackets):\n${texto}` }
			],
			response_format: ESQUEMA
		},
		'clasificar_sensibles'
	);
	return leerMarcados(
		respuesta.choices[0]?.message.content ?? '',
		fragmentos.map((f) => f.id)
	);
}

export function leerMarcados(contenido: string, idsValidos: number[]): Marcado[] {
	const validos = new Set(idsValidos);
	let datos: { marcados?: unknown };
	try {
		datos = JSON.parse(contenido);
	} catch {
		throw new Error('La clasificación de segmentos sensibles no devolvió JSON válido');
	}
	const lista = Array.isArray(datos.marcados) ? datos.marcados : [];
	const marcados: Marcado[] = [];
	for (const m of lista as Array<Record<string, unknown>>) {
		const id = Number(m?.fragmento_id);
		const categoria = m?.categoria as Categoria;
		if (!validos.has(id) || !CATEGORIAS.includes(categoria)) continue;
		marcados.push({ fragmentoId: id, categoria, motivo: String(m.motivo ?? '').slice(0, 200) });
	}
	return rellenarHuecos(marcados, idsValidos);
}

/** Huecos de hasta este tamaño entre dos fragmentos marcados también se protegen. */
const HUECO_MAXIMO = 3;

/**
 * Las peticiones de oración ocupan bloques de fragmentos seguidos, y el modelo se salta algunos:
 * en el ensayo del 2026-10-27 dejó visibles dos nombres, uno en el fragmento que abría el bloque
 * («vamos a orar por los familiares de…») y otro en un hueco de dos fragmentos. Por eso:
 * - se rellenan los huecos de hasta tres fragmentos entre dos marcados;
 * - cada bloque se extiende un fragmento hacia cada lado.
 * Ante la duda, se protege: el editor puede publicar lo que sobre.
 */
export function rellenarHuecos(marcados: Marcado[], idsEnOrden: number[]): Marcado[] {
	const porId = new Map(marcados.map((m) => [m.fragmentoId, m]));
	const resultado = [...marcados];
	const proteger = (indice: number, origen: Marcado, motivo: string) => {
		const id = idsEnOrden[indice];
		if (id === undefined || porId.has(id)) return;
		const nuevo: Marcado = { fragmentoId: id, categoria: origen.categoria, motivo };
		porId.set(id, nuevo);
		resultado.push(nuevo);
	};

	const indicesMarcados = idsEnOrden.map((id, i) => (porId.has(id) ? i : -1)).filter((i) => i >= 0);
	for (let k = 1; k < indicesMarcados.length; k++) {
		const desde = indicesMarcados[k - 1];
		const hasta = indicesMarcados[k];
		if (hasta - desde - 1 > 0 && hasta - desde - 1 <= HUECO_MAXIMO) {
			const origen = porId.get(idsEnOrden[desde])!;
			for (let i = desde + 1; i < hasta; i++) proteger(i, origen, 'Dentro de un bloque sensible');
		}
	}
	for (const i of indicesMarcados) {
		const origen = porId.get(idsEnOrden[i])!;
		proteger(i - 1, origen, 'Junto a un fragmento sensible');
		proteger(i + 1, origen, 'Junto a un fragmento sensible');
	}
	return resultado;
}

/**
 * Fragmentos que la clasificación puede tocar: todos los del video salvo los que una persona ya
 * decidió (aprobó u ocultó). Las decisiones humanas no se deshacen al reclasificar.
 */
export function fragmentosPorClasificar(
	db: Base,
	videoId: string
): Array<{ id: number; texto: string }> {
	return db
		.prepare(
			`SELECT f.id, f.texto FROM fragmentos f
			 WHERE f.video_id = ? AND f.visibilidad != 'oculto'
			   AND NOT EXISTS (SELECT 1 FROM pendientes p
			                   WHERE p.fragmento_id = f.id AND p.estado != 'pendiente')
			 ORDER BY f.orden`
		)
		.all(videoId) as Array<{ id: number; texto: string }>;
}

/**
 * Aplica la clasificación: lo marcado queda `pendiente` con su registro en la cola de revisión;
 * el resto pasa a `visible`. Reemplaza una clasificación anterior aún sin decidir.
 */
export function aplicarClasificacion(
	db: Base,
	videoId: string,
	clasificados: Array<{ id: number }>,
	marcados: Marcado[]
): void {
	const marcadosPorId = new Map(marcados.map((m) => [m.fragmentoId, m]));
	const cambiar = db.prepare(`UPDATE fragmentos SET visibilidad = ? WHERE id = ?`);
	const pendiente = db.prepare(
		`INSERT INTO pendientes (tipo, video_id, fragmento_id, categoria, contenido)
		 VALUES ('fragmento_sensible', ?, ?, ?, ?)`
	);
	db.transaction(() => {
		db.prepare(
			`DELETE FROM pendientes WHERE video_id = ? AND tipo = 'fragmento_sensible' AND estado = 'pendiente'`
		).run(videoId);
		for (const { id } of clasificados) {
			const marcado = marcadosPorId.get(id);
			if (marcado) {
				cambiar.run('pendiente', id);
				pendiente.run(videoId, id, marcado.categoria, marcado.motivo);
			} else {
				cambiar.run('visible', id);
			}
		}
		olvidarRespuestas(db);
	})();
}
