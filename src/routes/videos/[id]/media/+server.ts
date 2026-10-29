import { error } from '@sveltejs/kit';
import { join } from 'node:path';
import { ARCHIVO_REPRODUCCION } from '#lib/server/ingesta/pipeline.js';
import { servirConRangos } from '#lib/server/medios/servir.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { obtenerVideo } from '#lib/server/videos.js';
import type { RequestHandler } from './$types';

/** Sirve la versión para reproducir, con rangos para saltar a un minuto. */
export const GET: RequestHandler = async ({ params, request }) => {
	const { db, carpetaMedios } = obtenerServicios();
	if (!obtenerVideo(db, params.id)) error(404, 'Video no encontrado');
	return servirConRangos(join(carpetaMedios, params.id, ARCHIVO_REPRODUCCION), request, {
		'Content-Type': 'video/mp4',
		'Cache-Control': 'public, max-age=3600'
	});
};
