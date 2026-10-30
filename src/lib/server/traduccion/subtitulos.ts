import type { Base } from '../db/base';
import type { ClienteMeta } from '../meta/cliente';
import { fragmentosVisibles } from '../videos';
import { traducir } from './traducir';

/**
 * Subtítulos traducidos (spec idiomas-y-voz; design.md D6). El editor los pide desde `/admin` y se
 * generan en segundo plano, porque un video largo son varios lotes de Muse Spark. El avance se lee
 * de la base: cuántas líneas visibles tienen ya traducción.
 */

const enCurso = new Set<string>();
const clave = (videoId: string, idioma: string) => `${videoId}:${idioma}`;

export function subtitulandoAhora(videoId: string, idioma: string): boolean {
	return enCurso.has(clave(videoId, idioma));
}

/** Cuántas líneas visibles del video tienen traducción en ese idioma, de cuántas. */
export function avanceSubtitulos(
	db: Base,
	videoId: string,
	idioma: string
): { traducidas: number; total: number } {
	return db
		.prepare(
			`SELECT count(t.texto) AS traducidas, count(*) AS total
			 FROM fragmentos f
			 LEFT JOIN traducciones t ON t.original = f.texto AND t.idioma = ?
			 WHERE f.video_id = ? AND f.visibilidad = 'visible'`
		)
		.get(idioma, videoId) as { traducidas: number; total: number };
}

/**
 * Lanza la traducción de las líneas visibles que falten. Devuelve false si ya estaba en curso.
 * El error se registra y no tumba el servidor: el editor puede volver a lanzarla.
 */
export function subtitular(
	db: Base,
	meta: Pick<ClienteMeta, 'chat'>,
	videoId: string,
	idioma: string
): boolean {
	const k = clave(videoId, idioma);
	if (enCurso.has(k)) return false;
	enCurso.add(k);
	const textos = fragmentosVisibles(db, videoId).map((f) => f.texto);
	traducir(db, meta, textos, idioma, 'subtitulos')
		.catch((error) => console.error('Fallaron los subtítulos traducidos', videoId, error))
		.finally(() => enCurso.delete(k));
	return true;
}
