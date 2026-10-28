import type { Base } from './db/base';

export interface VideoPublico {
	id: string;
	titulo: string;
	duracionMs: number | null;
	estado: 'procesando' | 'listo' | 'con_errores';
}

export interface FragmentoPublico {
	id: number;
	inicioMs: number;
	finMs: number;
	texto: string;
}

/** Videos que ya tienen transcripción visible. Los que siguen procesándose no se listan. */
export function listarVideos(db: Base): VideoPublico[] {
	return db
		.prepare(
			`SELECT v.id, v.titulo, v.duracion_ms AS duracionMs, v.estado
			 FROM videos v
			 WHERE EXISTS (SELECT 1 FROM fragmentos f WHERE f.video_id = v.id AND f.visibilidad = 'visible')
			 ORDER BY v.creado_en DESC`
		)
		.all() as VideoPublico[];
}

export function obtenerVideo(db: Base, id: string): VideoPublico | undefined {
	return db
		.prepare(
			`SELECT id, titulo, duracion_ms AS duracionMs, estado FROM videos
			 WHERE id = ? AND archivo_reproduccion IS NOT NULL`
		)
		.get(id) as VideoPublico | undefined;
}

/** Fragmentos visibles en orden. Los pendientes de revisión y los ocultos no salen. */
export function fragmentosVisibles(db: Base, videoId: string): FragmentoPublico[] {
	return db
		.prepare(
			`SELECT id, inicio_ms AS inicioMs, fin_ms AS finMs, texto FROM fragmentos
			 WHERE video_id = ? AND visibilidad = 'visible' ORDER BY orden`
		)
		.all(videoId) as FragmentoPublico[];
}

/** Subtítulos WebVTT generados a partir de la transcripción visible. */
export function subtitulosVtt(fragmentos: FragmentoPublico[]): string {
	const marca = (ms: number) => {
		const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
		const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
		const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
		const mil = String(ms % 1000).padStart(3, '0');
		return `${h}:${m}:${s}.${mil}`;
	};
	const bloques = fragmentos.map(
		(f, i) =>
			`${i + 1}\n${marca(f.inicioMs)} --> ${marca(f.finMs)}\n${f.texto.replaceAll('-->', '→')}`
	);
	return ['WEBVTT', ...bloques].join('\n\n') + '\n';
}
