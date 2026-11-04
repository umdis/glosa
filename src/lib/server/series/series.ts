import type { Base } from '../db/base';
import { slugEtiqueta } from '../db/esquema';
import { MODELO_RAZONAMIENTO, type ClienteMeta } from '../meta/cliente';
import { fichaAprobada } from '../revision/resumen';
import { listarVideos, type VideoPublico } from '../videos';

/**
 * Series de videos (spec series-y-etiquetas; design.md D9). El editor las crea y las ordena; el
 * público las ve en `/series` y puede preguntar dentro de una. Solo se muestran los videos
 * públicos (con transcripción visible), aunque la serie tenga asignados otros todavía en proceso.
 */

export interface Serie {
	id: string;
	nombre: string;
	descripcion: string;
}

export interface SerieConVideos extends Serie {
	videos: VideoPublico[];
	/** Resumen aprobado por el editor; `null` si no hay ninguno. */
	resumen: string | null;
}

const LARGO_NOMBRE = 80;
const LARGO_DESCRIPCION = 600;

/** Crea una serie con id legible a partir del nombre («Familia» → `familia`, `familia-2`…). */
export function crearSerie(db: Base, nombre: string, descripcion = ''): Serie | null {
	const limpio = nombre.trim().slice(0, LARGO_NOMBRE);
	const base = slugEtiqueta(limpio);
	if (!base) return null;
	const existe = db.prepare(`SELECT 1 FROM series WHERE id = ?`);
	let id = base;
	for (let n = 2; existe.get(id); n++) id = `${base}-${n}`;
	const serie = { id, nombre: limpio, descripcion: descripcion.trim().slice(0, LARGO_DESCRIPCION) };
	db.prepare(`INSERT INTO series (id, nombre, descripcion) VALUES (?, ?, ?)`).run(
		serie.id,
		serie.nombre,
		serie.descripcion
	);
	return serie;
}

export function editarSerie(db: Base, id: string, nombre: string, descripcion: string): boolean {
	const limpio = nombre.trim().slice(0, LARGO_NOMBRE);
	if (!limpio) return false;
	return (
		db
			.prepare(`UPDATE series SET nombre = ?, descripcion = ? WHERE id = ?`)
			.run(limpio, descripcion.trim().slice(0, LARGO_DESCRIPCION), id).changes > 0
	);
}

export function borrarSerie(db: Base, id: string): boolean {
	return db.prepare(`DELETE FROM series WHERE id = ?`).run(id).changes > 0;
}

/** Sustituye los videos de la serie, en el orden dado. Ignora ids que no existen. */
export function asignarVideos(db: Base, serieId: string, videoIds: string[]): void {
	const existe = db.prepare(`SELECT 1 FROM videos WHERE id = ?`);
	db.transaction(() => {
		db.prepare(`DELETE FROM series_videos WHERE serie_id = ?`).run(serieId);
		const insertar = db.prepare(
			`INSERT OR IGNORE INTO series_videos (serie_id, video_id, orden) VALUES (?, ?, ?)`
		);
		[...new Set(videoIds)].forEach((videoId, orden) => {
			if (existe.get(videoId)) insertar.run(serieId, videoId, orden);
		});
	})();
}

export function obtenerSerie(db: Base, id: string): Serie | undefined {
	return db.prepare(`SELECT id, nombre, descripcion FROM series WHERE id = ?`).get(id) as
		Serie | undefined;
}

/** Ids de los videos asignados a la serie, en orden (públicos o no: para el editor). */
export function idsDeSerie(db: Base, serieId: string): string[] {
	return (
		db
			.prepare(`SELECT video_id FROM series_videos WHERE serie_id = ? ORDER BY orden, video_id`)
			.all(serieId) as Array<{ video_id: string }>
	).map((f) => f.video_id);
}

/** Una serie con sus videos públicos en orden y su resumen aprobado. */
export function serieCompleta(db: Base, id: string): SerieConVideos | undefined {
	const serie = obtenerSerie(db, id);
	if (!serie) return undefined;
	const publicos = new Map(listarVideos(db).map((v) => [v.id, v]));
	return {
		...serie,
		videos: idsDeSerie(db, id)
			.map((v) => publicos.get(v))
			.filter((v): v is VideoPublico => Boolean(v)),
		resumen: resumenAprobado(db, id)
	};
}

/** Todas las series, con sus videos públicos. Las que no tienen ninguno no se listan al público. */
export function listarSeries(db: Base, { conVacias = false } = {}): SerieConVideos[] {
	const ids = db.prepare(`SELECT id FROM series ORDER BY creada_en, id`).all() as Array<{
		id: string;
	}>;
	return ids.map((f) => serieCompleta(db, f.id)!).filter((s) => conVacias || s.videos.length > 0);
}

// ── Resumen compilado ──────────────────────────────────────────────────────────────────────────

const INSTRUCCIONES_RESUMEN = `You write the overview of a series of videos in a research archive.
You receive the approved catalogue entry (summary and topics) of each video in the series.
Write 4 to 6 sentences on what the series covers as a whole and how the videos relate, in the language of the entries.
Plain and factual, no praise. Use only what is in the entries; do not add teachings that are not there.`;

/**
 * Pide a Muse Spark el resumen de la serie a partir de las fichas aprobadas de sus videos y lo
 * guarda pendiente de revisión. Devuelve `null` si ningún video tiene ficha aprobada: sin esa
 * base no hay nada verificado que resumir.
 */
export async function proponerResumenSerie(
	db: Base,
	meta: Pick<ClienteMeta, 'chat'>,
	serieId: string
): Promise<string | null> {
	const serie = serieCompleta(db, serieId);
	if (!serie) return null;
	const fichas = serie.videos
		.map((v) => ({ titulo: v.titulo, ...fichaAprobada(db, v.id) }))
		.filter((f) => f.resumen);
	if (fichas.length === 0) return null;

	const entradas = fichas
		.map((f) => `Video: ${f.titulo}\nSummary: ${f.resumen}\nTopics: ${f.temas.join(', ')}`)
		.join('\n\n');
	const respuesta = await meta.chat(
		{
			model: MODELO_RAZONAMIENTO,
			messages: [
				{ role: 'system', content: INSTRUCCIONES_RESUMEN },
				{ role: 'user', content: `Series: ${serie.nombre}\n\n${entradas}` }
			]
		},
		'resumen_serie'
	);
	const contenido = (respuesta.choices[0]?.message.content ?? '').trim().slice(0, 2000);
	if (!contenido) throw new Error('El resumen de la serie llegó vacío');
	db.transaction(() => {
		db.prepare(`DELETE FROM series_resumenes WHERE serie_id = ? AND estado = 'pendiente'`).run(
			serieId
		);
		db.prepare(`INSERT INTO series_resumenes (serie_id, contenido) VALUES (?, ?)`).run(
			serieId,
			contenido
		);
	})();
	return contenido;
}

export interface ResumenPendiente {
	id: number;
	serieId: string;
	nombre: string;
	contenido: string;
}

export function resumenesPendientes(db: Base): ResumenPendiente[] {
	return db
		.prepare(
			`SELECT r.id, r.serie_id AS serieId, s.nombre, r.contenido
			 FROM series_resumenes r JOIN series s ON s.id = r.serie_id
			 WHERE r.estado = 'pendiente' ORDER BY r.creado_en`
		)
		.all() as ResumenPendiente[];
}

export function decidirResumenSerie(
	db: Base,
	id: number,
	decision: 'aprobado' | 'oculto',
	quien: string
): boolean {
	return (
		db
			.prepare(
				`UPDATE series_resumenes SET estado = ?, decidido_por = ?, decidido_en = datetime('now')
				 WHERE id = ? AND estado = 'pendiente'`
			)
			.run(decision, quien, id).changes > 0
	);
}

export function resumenAprobado(db: Base, serieId: string): string | null {
	const fila = db
		.prepare(
			`SELECT contenido FROM series_resumenes WHERE serie_id = ? AND estado = 'aprobado'
			 ORDER BY decidido_en DESC, id DESC LIMIT 1`
		)
		.get(serieId) as { contenido: string } | undefined;
	return fila?.contenido ?? null;
}
