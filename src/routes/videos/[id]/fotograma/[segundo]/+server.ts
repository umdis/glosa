import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SHOW_FRAMES } from '$app/env/private';
import { anchoValido, obtenerFotograma, segundoValido } from '#lib/server/fotogramas.js';
import { ARCHIVO_REPRODUCCION } from '#lib/server/ingesta/pipeline.js';
import { extraerFotograma } from '#lib/server/medios/ffmpeg.js';
import { obtenerDifuminado } from '#lib/server/privacidad/difuminar.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { conPrivacidadVisual, videoPublico } from '#lib/server/videos.js';
import type { RequestHandler } from './$types';

/**
 * El cuadro del video en un segundo (`?w=320|640`). Solo de videos públicos y si el propietario
 * no apagó los fotogramas con SHOW_FRAMES (pueden mostrar a la congregación).
 *
 * Con la privacidad visual del video activa (spec privacidad-visual), se sirve el cuadro con el
 * público difuminado por SAM 3.1. Si no se puede difuminar (SAM falla o el tope de gasto se
 * alcanzó), 404: la interfaz muestra el minuto. El original nunca sale.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	if (!SHOW_FRAMES) error(404, 'Fotogramas desactivados');
	const { db, rutas, carpetaMedios, meta, topeAlcanzado } = obtenerServicios();
	const video = videoPublico(db, params.id);
	if (!video) error(404, 'Video no encontrado');
	const segundo = segundoValido(params.segundo, video.duracionMs);
	if (segundo === null) error(400, 'Segundo inválido');

	const carpetaVideo = join(carpetaMedios, params.id);
	const ancho = anchoValido(url.searchParams.get('w'));
	let ruta: string;
	try {
		ruta = await obtenerFotograma({
			carpetaVideo,
			archivoVideo: join(carpetaVideo, ARCHIVO_REPRODUCCION),
			segundo,
			ancho,
			extraer: (entrada, s, a, salida) => extraerFotograma(rutas, entrada, s, a, salida)
		});
		if (conPrivacidadVisual(db, params.id)) {
			ruta = await obtenerDifuminado(
				{ meta, ffmpeg: rutas.ffmpeg },
				ruta,
				join(carpetaVideo, 'difuminados', `${segundo}-${ancho}.jpg`),
				() => !topeAlcanzado()
			);
		}
	} catch (e) {
		console.error(`No se pudo servir el fotograma ${params.id}@${segundo}`, e);
		error(404, 'Fotograma no disponible');
	}
	return new Response(new Uint8Array(await readFile(ruta)), {
		headers: {
			'Content-Type': 'image/jpeg',
			// No «immutable»: si el editor activa la privacidad, el cuadro sin difuminar no debe
			// quedarse un año en la caché del navegador.
			'Cache-Control': 'public, max-age=600'
		}
	});
};
