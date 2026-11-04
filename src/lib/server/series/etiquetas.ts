import type { Base } from '../db/base';
import { listarVideos, type VideoPublico } from '../videos';

/**
 * Etiquetas (spec series-y-etiquetas; design.md D10): los temas aprobados de las fichas,
 * normalizados. Solo cuentan los videos públicos.
 */

export interface Etiqueta {
	id: number;
	nombre: string;
	slug: string;
}

export interface EtiquetaConVideos extends Etiqueta {
	videos: VideoPublico[];
}

/** Todas las etiquetas con al menos un video público, por nombre. */
export function listarEtiquetas(db: Base): EtiquetaConVideos[] {
	const publicos = new Map(listarVideos(db).map((v) => [v.id, v]));
	const etiquetas = db
		.prepare(`SELECT id, nombre, slug FROM etiquetas ORDER BY nombre COLLATE NOCASE`)
		.all() as Etiqueta[];
	const relaciones = db
		.prepare(`SELECT etiqueta_id AS etiquetaId, video_id AS videoId FROM video_etiquetas`)
		.all() as Array<{ etiquetaId: number; videoId: string }>;
	return etiquetas
		.map((e) => ({
			...e,
			videos: relaciones
				.filter((r) => r.etiquetaId === e.id)
				.map((r) => publicos.get(r.videoId))
				.filter((v): v is VideoPublico => Boolean(v))
		}))
		.filter((e) => e.videos.length > 0);
}

export function etiquetaPorSlug(db: Base, slug: string): Etiqueta | undefined {
	return db.prepare(`SELECT id, nombre, slug FROM etiquetas WHERE slug = ?`).get(slug) as
		Etiqueta | undefined;
}

/** Ids de los videos con esa etiqueta. */
export function videosConEtiqueta(db: Base, etiquetaId: number): string[] {
	return (
		db
			.prepare(`SELECT video_id FROM video_etiquetas WHERE etiqueta_id = ?`)
			.all(etiquetaId) as Array<{ video_id: string }>
	).map((f) => f.video_id);
}

export function etiquetasDeVideo(db: Base, videoId: string): Etiqueta[] {
	return db
		.prepare(
			`SELECT e.id, e.nombre, e.slug FROM etiquetas e
			 JOIN video_etiquetas ve ON ve.etiqueta_id = e.id
			 WHERE ve.video_id = ? ORDER BY e.nombre COLLATE NOCASE`
		)
		.all(videoId) as Etiqueta[];
}

/**
 * Fusiona `absorbida` en `destino`: sus videos pasan al destino, la absorbida se borra y su slug
 * (y los que ya apuntaban a ella) quedan como alias del destino.
 */
export function fusionarEtiquetas(db: Base, absorbida: number, destino: number): boolean {
	if (absorbida === destino) return false;
	const origen = db.prepare(`SELECT slug FROM etiquetas WHERE id = ?`).get(absorbida) as
		{ slug: string } | undefined;
	if (!origen || !db.prepare(`SELECT 1 FROM etiquetas WHERE id = ?`).get(destino)) return false;
	db.transaction(() => {
		db.prepare(
			`INSERT OR IGNORE INTO video_etiquetas (video_id, etiqueta_id)
			 SELECT video_id, ? FROM video_etiquetas WHERE etiqueta_id = ?`
		).run(destino, absorbida);
		db.prepare(`UPDATE etiquetas_alias SET etiqueta_id = ? WHERE etiqueta_id = ?`).run(
			destino,
			absorbida
		);
		db.prepare(
			`INSERT INTO etiquetas_alias (slug, etiqueta_id) VALUES (?, ?)
			 ON CONFLICT (slug) DO UPDATE SET etiqueta_id = excluded.etiqueta_id`
		).run(origen.slug, destino);
		db.prepare(`DELETE FROM etiquetas WHERE id = ?`).run(absorbida);
	})();
	return true;
}

/** Todas las etiquetas, también las que no tienen videos públicos: para el editor. */
export function todasLasEtiquetas(db: Base): Array<Etiqueta & { usos: number }> {
	return db
		.prepare(
			`SELECT e.id, e.nombre, e.slug, COUNT(ve.video_id) AS usos FROM etiquetas e
			 LEFT JOIN video_etiquetas ve ON ve.etiqueta_id = e.id
			 GROUP BY e.id ORDER BY e.nombre COLLATE NOCASE`
		)
		.all() as Array<Etiqueta & { usos: number }>;
}
