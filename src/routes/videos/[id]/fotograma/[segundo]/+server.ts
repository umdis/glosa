import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SHOW_FRAMES } from '$app/env/private';
import { anchoValido, obtenerFotograma, segundoValido } from '#lib/server/fotogramas.js';
import { ARCHIVO_REPRODUCCION } from '#lib/server/ingesta/pipeline.js';
import { extraerFotograma } from '#lib/server/medios/ffmpeg.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { videoPublico } from '#lib/server/videos.js';
import type { RequestHandler } from './$types';

/**
 * El cuadro del video en un segundo (`?w=320|640`). Solo de videos públicos y si el propietario
 * no apagó los fotogramas con SHOW_FRAMES (pueden mostrar a la congregación).
 */
export const GET: RequestHandler = async ({ params, url }) => {
	if (!SHOW_FRAMES) error(404, 'Fotogramas desactivados');
	const { db, rutas, carpetaMedios } = obtenerServicios();
	const video = videoPublico(db, params.id);
	if (!video) error(404, 'Video no encontrado');
	const segundo = segundoValido(params.segundo, video.duracionMs);
	if (segundo === null) error(400, 'Segundo inválido');

	const carpetaVideo = join(carpetaMedios, params.id);
	let ruta: string;
	try {
		ruta = await obtenerFotograma({
			carpetaVideo,
			archivoVideo: join(carpetaVideo, ARCHIVO_REPRODUCCION),
			segundo,
			ancho: anchoValido(url.searchParams.get('w')),
			extraer: (entrada, s, ancho, salida) => extraerFotograma(rutas, entrada, s, ancho, salida)
		});
	} catch (e) {
		console.error(`No se pudo sacar el fotograma ${params.id}@${segundo}`, e);
		error(404, 'Fotograma no disponible');
	}
	return new Response(new Uint8Array(await readFile(ruta)), {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
