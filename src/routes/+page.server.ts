import { referencia } from '#lib/formato.js';
import { indicePublico } from '#lib/server/biblia/indice.js';
import { notaEspecimen } from '#lib/server/especimen.js';
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

	// El espécimen (interfaz-con-volumen D5): el pasaje dicho cuya frase mejor se lee sola.
	const dichos = momentos
		.filter((m) => m.origen === 'dicho' && m.fragmentoId !== null)
		.sort((a, b) => a.momentoMs - b.momentoMs)
		.map((m) => ({
			momento: m,
			fragmento: db
				.prepare(`SELECT texto, inicio_ms AS inicioMs FROM fragmentos WHERE id = ?`)
				.get(m.fragmentoId) as { texto: string; inicioMs: number } | undefined
		}))
		.filter((d) => d.fragmento);
	const elegido = dichos
		.map((d) => ({ ...d, nota: notaEspecimen(d.fragmento!.texto, d.momento.versiculoInicio) }))
		.sort((a, b) => b.nota - a.nota)[0];
	const primero = elegido?.momento;
	const fragmento = elegido?.fragmento;

	// El colofón: lo que hizo cada modelo con esta colección, con las cifras de la base.
	const contar = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
	const publicos = `SELECT v.id FROM videos v WHERE EXISTS
		(SELECT 1 FROM fragmentos f WHERE f.video_id = v.id AND f.visibilidad = 'visible')`;
	const colofon = {
		fragmentos: contar(
			`SELECT count(*) n FROM fragmentos WHERE visibilidad = 'visible' AND video_id IN (${publicos})`
		),
		retenidos: contar(
			`SELECT count(*) n FROM fragmentos WHERE visibilidad <> 'visible' AND video_id IN (${publicos})`
		),
		enPantalla: contar(`SELECT count(*) n FROM en_pantalla WHERE video_id IN (${publicos})`)
	};

	// Sugerencias que seguro encuentran algo: temas aprobados y libros que se nombraron en voz alta.
	const sugerencias = [
		...new Set([
			...coleccion.flatMap((v) => v.temas),
			...momentos.filter((m) => m.origen === 'dicho').map((m) => m.libro)
		])
	].slice(0, 5);

	return {
		videos: coleccion,
		ejemplos: sugerencias.slice(0, 3).map((s) => `What was said about ${s}?`),
		cifras: {
			videos: videos.length,
			duracionMs: videos.reduce((suma, v) => suma + (v.duracionMs ?? 0), 0),
			pasajes: indice.reduce((suma, l) => suma + l.pasajes.length, 0),
			...colofon
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
