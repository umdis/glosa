import { error } from '@sveltejs/kit';
import { obtenerServicios } from '#lib/server/servicios.js';
import { idiomaValido, traduccionesGuardadas } from '#lib/server/traduccion/traducir.js';
import { fragmentosVisibles, obtenerVideo, subtitulosVtt } from '#lib/server/videos.js';
import type { RequestHandler } from './$types';

/**
 * Subtítulos del video, generados de la transcripción visible. Con `?lang=en`, las líneas
 * traducidas por Muse Spark con los mismos tiempos; las que aún no tienen traducción se omiten.
 */
export const GET: RequestHandler = ({ params, url }) => {
	const { db } = obtenerServicios();
	if (!obtenerVideo(db, params.id)) error(404, 'Video no encontrado');
	const fragmentos = fragmentosVisibles(db, params.id);
	const idioma = idiomaValido(url.searchParams.get('lang'));

	if (idioma && idioma !== 'es') {
		const traducidas = traduccionesGuardadas(
			db,
			fragmentos.map((f) => f.texto),
			idioma
		);
		const lineas = fragmentos
			.filter((f) => traducidas.has(f.texto))
			.map((f) => ({ ...f, texto: traducidas.get(f.texto)! }));
		if (lineas.length === 0) error(404, 'No hay subtítulos en ese idioma');
		return new Response(subtitulosVtt(lineas), {
			headers: { 'Content-Type': 'text/vtt; charset=utf-8' }
		});
	}

	return new Response(subtitulosVtt(fragmentos), {
		headers: { 'Content-Type': 'text/vtt; charset=utf-8' }
	});
};
