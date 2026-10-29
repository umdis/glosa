import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { ARCHIVO_REPRODUCCION } from '#lib/server/ingesta/pipeline.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { obtenerVideo } from '#lib/server/videos.js';
import type { RequestHandler } from './$types';

/**
 * Sirve la versión para reproducir con soporte de rangos (`Range`), que el navegador necesita
 * para saltar a un minuto sin descargar el video entero.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	const { db, carpetaMedios } = obtenerServicios();
	if (!obtenerVideo(db, params.id)) error(404, 'Video no encontrado');
	const ruta = join(carpetaMedios, params.id, ARCHIVO_REPRODUCCION);
	const { size } = await stat(ruta).catch(() => error(404, 'Video no disponible'));

	const cabeceras = {
		'Content-Type': 'video/mp4',
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'public, max-age=3600'
	};
	const rango = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (!rango) {
		return new Response(Readable.toWeb(createReadStream(ruta)) as ReadableStream, {
			headers: { ...cabeceras, 'Content-Length': String(size) }
		});
	}

	let inicio = rango[1] ? Number(rango[1]) : size - Number(rango[2]);
	let fin = rango[1] && rango[2] ? Number(rango[2]) : size - 1;
	inicio = Math.max(0, inicio);
	fin = Math.min(fin, size - 1);
	if (inicio > fin || Number.isNaN(inicio)) {
		return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
	}
	return new Response(
		Readable.toWeb(createReadStream(ruta, { start: inicio, end: fin })) as ReadableStream,
		{
			status: 206,
			headers: {
				...cabeceras,
				'Content-Range': `bytes ${inicio}-${fin}/${size}`,
				'Content-Length': String(fin - inicio + 1)
			}
		}
	);
};
