import type { Base } from '../db/base';
import { MODELO_RAZONAMIENTO, type ClienteMeta } from '../meta/cliente';

/**
 * Resumen y temas propuestos por Muse Spark para un video. Nunca se publican solos: quedan
 * pendientes hasta que un administrador los aprueba (design.md D9, «la IA propone, la persona
 * decide»). Se hacen sobre la transcripción visible, nunca sobre lo marcado como sensible.
 */

export interface Propuesta {
	resumen: string;
	temas: string[];
}

const INSTRUCCIONES = `You write the catalogue entry of a video in a research archive.
From the transcript, write:
- resumen: 3 or 4 sentences on what the video teaches, in the language of the transcript. Plain and factual, no praise.
- temas: 3 to 6 short topics (one to three words each), in the language of the transcript.
Use only what is in the transcript.`;

const ESQUEMA = {
	type: 'json_schema',
	json_schema: {
		name: 'ficha_video',
		schema: {
			type: 'object',
			properties: {
				resumen: { type: 'string' },
				temas: { type: 'array', items: { type: 'string' } }
			},
			required: ['resumen', 'temas'],
			additionalProperties: false
		}
	}
};

export async function proponerFicha(
	meta: Pick<ClienteMeta, 'chat'>,
	titulo: string,
	transcripcion: string
): Promise<Propuesta> {
	const respuesta = await meta.chat(
		{
			model: MODELO_RAZONAMIENTO,
			messages: [
				{ role: 'system', content: INSTRUCCIONES },
				{ role: 'user', content: `Title: ${titulo}\n\nTranscript:\n${transcripcion}` }
			],
			response_format: ESQUEMA
		},
		'proponer_ficha'
	);
	const datos = JSON.parse(respuesta.choices[0]?.message.content ?? '{}') as Partial<Propuesta>;
	if (typeof datos.resumen !== 'string' || !datos.resumen.trim()) {
		throw new Error('La propuesta de resumen llegó vacía');
	}
	return {
		resumen: datos.resumen.trim().slice(0, 1500),
		temas: (Array.isArray(datos.temas) ? datos.temas : [])
			.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
			.map((t) => t.trim().slice(0, 60))
			.slice(0, 6)
	};
}

/** Guarda la propuesta como pendiente, reemplazando una propuesta anterior sin decidir. */
export function guardarFicha(db: Base, videoId: string, propuesta: Propuesta): void {
	db.transaction(() => {
		db.prepare(
			`DELETE FROM pendientes WHERE video_id = ? AND tipo IN ('resumen', 'temas') AND estado = 'pendiente'`
		).run(videoId);
		const insertar = db.prepare(
			`INSERT INTO pendientes (tipo, video_id, contenido) VALUES (?, ?, ?)`
		);
		insertar.run('resumen', videoId, propuesta.resumen);
		if (propuesta.temas.length) insertar.run('temas', videoId, JSON.stringify(propuesta.temas));
	})();
}

/** Ficha aprobada de un video, para la vista pública. */
export function fichaAprobada(
	db: Base,
	videoId: string
): { resumen: string | null; temas: string[] } {
	const filas = db
		.prepare(
			`SELECT tipo, contenido FROM pendientes
			 WHERE video_id = ? AND tipo IN ('resumen', 'temas') AND estado = 'aprobado'
			 ORDER BY decidido_en DESC`
		)
		.all(videoId) as Array<{ tipo: string; contenido: string }>;
	const resumen = filas.find((f) => f.tipo === 'resumen')?.contenido ?? null;
	const temas = filas.find((f) => f.tipo === 'temas');
	return { resumen, temas: temas ? (JSON.parse(temas.contenido) as string[]) : [] };
}
