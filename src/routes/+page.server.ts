import { referencia } from '#lib/formato.js';
import { indicePublico } from '#lib/server/biblia/indice.js';
import { segundoPoster } from '#lib/server/fotogramas.js';
import { fichaAprobada } from '#lib/server/revision/resumen.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { listarVideos } from '#lib/server/videos.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { db } = obtenerServicios();
	const videos = listarVideos(db);
	const indice = indicePublico(db);
	const momentos = indice.flatMap((l) =>
		l.pasajes.flatMap((p) => p.momentos.map((m) => ({ ...p, ...m })))
	);

	const coleccion = videos.map((v) => ({
		...v,
		posterSegundo: segundoPoster(v.duracionMs),
		temas: fichaAprobada(db, v.id).temas.slice(0, 3),
		pasajes: momentos.filter((m) => m.videoId === v.id).length
	}));

	// El espécimen: el primer pasaje dicho de la colección, con la frase en la que se dijo.
	const primero = momentos
		.filter((m) => m.origen === 'dicho' && m.fragmentoId !== null)
		.sort((a, b) => a.momentoMs - b.momentoMs)[0];
	const fragmento = primero
		? (db
				.prepare(`SELECT texto, inicio_ms AS inicioMs FROM fragmentos WHERE id = ?`)
				.get(primero.fragmentoId) as { texto: string; inicioMs: number } | undefined)
		: undefined;

	// Sugerencias que seguro encuentran algo: temas aprobados y libros que se nombraron en voz alta.
	const sugerencias = [
		...new Set([
			...coleccion.flatMap((v) => v.temas),
			...momentos.filter((m) => m.origen === 'dicho').map((m) => m.libro)
		])
	].slice(0, 5);

	return {
		videos: coleccion,
		sugerencias,
		cifras: {
			videos: videos.length,
			duracionMs: videos.reduce((suma, v) => suma + (v.duracionMs ?? 0), 0),
			pasajes: indice.reduce((suma, l) => suma + l.pasajes.length, 0)
		},
		especimen:
			primero && fragmento
				? {
						videoId: primero.videoId,
						titulo: primero.titulo,
						momentoMs: primero.momentoMs,
						fragmentoMs: fragmento.inicioMs,
						texto: fragmento.texto,
						referencia: referencia(primero)
					}
				: null
	};
};
