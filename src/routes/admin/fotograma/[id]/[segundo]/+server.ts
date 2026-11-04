import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ADMIN_TOKEN } from '$app/env/private';
import { esAdmin } from '#lib/server/acceso.js';
import { obtenerFotograma, segundoValido } from '#lib/server/fotogramas.js';
import { ARCHIVO_REPRODUCCION } from '#lib/server/ingesta/pipeline.js';
import { extraerFotograma } from '#lib/server/medios/ffmpeg.js';
import { obtenerDifuminado } from '#lib/server/privacidad/difuminar.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { obtenerVideo } from '#lib/server/videos.js';
import type { RequestHandler } from './$types';

/**
 * Vista previa de la privacidad visual, solo para el editor (spec privacidad-visual: «ve el mismo
 * fotograma original y difuminado»). `?version=original|difuminado`, a 640 px. Funciona aunque la
 * privacidad esté apagada, para decidir antes de activarla. Nunca se cachea en el navegador.
 */
export const GET: RequestHandler = async ({ params, url, request, cookies }) => {
	if (!esAdmin(request, ADMIN_TOKEN, cookies)) error(401, 'Se requiere la clave de administrador');
	const { db, rutas, carpetaMedios, meta, topeAlcanzado } = obtenerServicios();
	const video = obtenerVideo(db, params.id);
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
			ancho: 640,
			extraer: (entrada, s, a, salida) => extraerFotograma(rutas, entrada, s, a, salida)
		});
		if (url.searchParams.get('version') !== 'original') {
			ruta = await obtenerDifuminado(
				{ meta, ffmpeg: rutas.ffmpeg },
				ruta,
				join(carpetaVideo, 'difuminados', `${segundo}-640.jpg`),
				() => !topeAlcanzado()
			);
		}
	} catch (e) {
		console.error(`Vista previa de privacidad ${params.id}@${segundo}`, e);
		error(502, 'No se pudo difuminar este fotograma');
	}
	return new Response(new Uint8Array(await readFile(ruta)), {
		headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' }
	});
};
