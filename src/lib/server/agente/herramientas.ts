import { buscar } from '../busqueda/buscar';
import type { Base } from '../db/base';
import type { DefinicionHerramienta } from '../meta/cliente';

/**
 * Herramientas del agente investigador (design.md D6). Todas son de solo lectura y solo ven
 * contenido visible: lo pendiente de revisión y lo oculto no existen para el agente.
 * No devuelven minutos: el agente cita por fragmento y el minuto lo pone el servidor.
 */

export interface FragmentoEvidencia {
	fragmento_id: number;
	video_id: string;
	video: string;
	texto: string;
}

export const DEFINICIONES: DefinicionHerramienta[] = [
	{
		type: 'function',
		function: {
			name: 'listar_videos',
			description: 'List the videos in the collection with their ids and titles.',
			parameters: { type: 'object', properties: {}, additionalProperties: false }
		}
	},
	{
		type: 'function',
		function: {
			name: 'buscar',
			description:
				'Full-text search over what was said in the videos (Spanish stemming: «tentaciones» also finds «tentación»). All words must appear. Returns transcript fragments. Search several times with synonyms, other word forms and shorter queries: a paraphrase will not match.',
			parameters: {
				type: 'object',
				properties: {
					consulta: {
						type: 'string',
						description: 'One to four words, in the language of the videos.'
					},
					video_id: { type: 'string', description: 'Optional: restrict to one video.' }
				},
				required: ['consulta'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'leer_fragmentos',
			description:
				'Read a fragment together with its neighbours, to understand the context of a search result before citing it.',
			parameters: {
				type: 'object',
				properties: {
					fragmento_id: { type: 'integer' },
					alrededor: {
						type: 'integer',
						description: 'Fragments to read on each side (1 to 4). Default 2.'
					}
				},
				required: ['fragmento_id'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'en_pantalla',
			description:
				'Text that appeared on screen in a video (slides, whiteboard, verses), each with the transcript fragment that was playing at that moment.',
			parameters: {
				type: 'object',
				properties: { video_id: { type: 'string' } },
				required: ['video_id'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'pasajes',
			description:
				'Find where a Bible book or passage was cited in the collection (spoken or on screen). Use the Spanish book name, e.g. «Santiago» or «Santiago 1».',
			parameters: {
				type: 'object',
				properties: { referencia: { type: 'string' } },
				required: ['referencia'],
				additionalProperties: false
			}
		}
	}
];

type Argumentos = Record<string, unknown>;

/** Ejecuta una herramienta. Devuelve JSON para el modelo y registra la evidencia vista. */
export function ejecutarHerramienta(
	db: Base,
	nombre: string,
	argumentos: Argumentos,
	evidencia: Map<number, FragmentoEvidencia>
): string {
	const registrar = (fragmentos: FragmentoEvidencia[]) => {
		for (const f of fragmentos) evidencia.set(f.fragmento_id, f);
		return fragmentos;
	};

	switch (nombre) {
		case 'listar_videos':
			return JSON.stringify(
				db
					.prepare(
						`SELECT v.id AS video_id, v.titulo AS video FROM videos v
						 WHERE EXISTS (SELECT 1 FROM fragmentos f WHERE f.video_id = v.id AND f.visibilidad = 'visible')`
					)
					.all()
			);

		case 'buscar': {
			const consulta = String(argumentos.consulta ?? '').slice(0, 200);
			const videoId = typeof argumentos.video_id === 'string' ? argumentos.video_id : undefined;
			const resultados = buscar(db, consulta, { limite: 12, videoId }).map((r) => ({
				fragmento_id: r.fragmentoId,
				video_id: r.videoId,
				video: r.titulo,
				texto: r.texto
			}));
			return JSON.stringify(
				resultados.length ? registrar(resultados) : { sin_resultados: true, consulta }
			);
		}

		case 'leer_fragmentos': {
			const id = Number(argumentos.fragmento_id);
			const alrededor = Math.min(Math.max(Number(argumentos.alrededor ?? 2) || 2, 1), 4);
			const centro = db
				.prepare(`SELECT video_id, orden FROM fragmentos WHERE id = ? AND visibilidad = 'visible'`)
				.get(id) as { video_id: string; orden: number } | undefined;
			if (!centro) return JSON.stringify({ error: 'Fragment not found' });
			const filas = db
				.prepare(
					`SELECT f.id AS fragmento_id, f.video_id, v.titulo AS video, f.texto
					 FROM fragmentos f JOIN videos v ON v.id = f.video_id
					 WHERE f.video_id = ? AND f.orden BETWEEN ? AND ? AND f.visibilidad = 'visible'
					 ORDER BY f.orden`
				)
				.all(
					centro.video_id,
					centro.orden - alrededor,
					centro.orden + alrededor
				) as FragmentoEvidencia[];
			return JSON.stringify(registrar(filas));
		}

		case 'en_pantalla': {
			const videoId = String(argumentos.video_id ?? '');
			const filas = db
				.prepare(
					`SELECT p.texto AS en_pantalla,
						(SELECT f.id FROM fragmentos f
						 WHERE f.video_id = p.video_id AND f.inicio_ms <= p.momento_ms AND f.visibilidad = 'visible'
						 ORDER BY f.inicio_ms DESC LIMIT 1) AS fragmento_id
					 FROM en_pantalla p WHERE p.video_id = ? ORDER BY p.momento_ms`
				)
				.all(videoId);
			return JSON.stringify(filas.length ? filas : { sin_resultados: true });
		}

		case 'pasajes': {
			const referencia = String(argumentos.referencia ?? '').trim();
			const coincidencia = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(referencia);
			const libro = (coincidencia?.[1] ?? referencia).trim();
			const capitulo = coincidencia?.[2] ? Number(coincidencia[2]) : undefined;
			const filas = db
				.prepare(
					`SELECT p.libro, p.capitulo, p.versiculo_inicio, p.versiculo_fin, p.origen,
						p.fragmento_id, p.video_id, v.titulo AS video, f.texto
					 FROM pasajes p JOIN videos v ON v.id = p.video_id
					 LEFT JOIN fragmentos f ON f.id = p.fragmento_id AND f.visibilidad = 'visible'
					 WHERE p.libro LIKE ? AND (? IS NULL OR p.capitulo = ?)
					 ORDER BY p.capitulo, p.versiculo_inicio LIMIT 30`
				)
				.all(`%${libro}%`, capitulo ?? null, capitulo ?? null) as Array<
				Record<string, unknown> & {
					fragmento_id: number | null;
					video_id: string;
					video: string;
					texto: string | null;
				}
			>;
			const visibles = filas.filter((f) => f.fragmento_id === null || f.texto !== null);
			for (const f of visibles) {
				if (f.fragmento_id !== null && f.texto !== null) {
					evidencia.set(f.fragmento_id, {
						fragmento_id: f.fragmento_id,
						video_id: f.video_id,
						video: f.video,
						texto: f.texto
					});
				}
			}
			return JSON.stringify(visibles.length ? visibles : { sin_resultados: true, referencia });
		}

		default:
			return JSON.stringify({ error: `Unknown tool ${nombre}` });
	}
}
