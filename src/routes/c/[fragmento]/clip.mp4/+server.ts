import { error } from '@sveltejs/kit';
import { join } from 'node:path';
import { SHOW_FRAMES } from '$app/env/private';
import { pedidoClip } from '#lib/server/clips/generar.js';
import { servirConRangos } from '#lib/server/medios/servir.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { RequestHandler } from './$types';

/**
 * El MP4 del clip, si ya se generó. La ventana se recalcula en cada petición: si algo de lo que
 * contenía se ocultó, el nombre en caché cambia y el clip viejo deja de servirse.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	const { db, carpetaMedios } = obtenerServicios();
	const id = Number(params.fragmento);
	const pedido = Number.isInteger(id) ? pedidoClip(db, id, SHOW_FRAMES) : null;
	if (!pedido) error(404, 'Clip not found');
	return servirConRangos(join(carpetaMedios, pedido.videoId, 'clips', pedido.archivo), request, {
		'Content-Type': 'video/mp4',
		'Content-Disposition': `inline; filename="glosa-clip-${id}.mp4"`,
		'Cache-Control': 'public, max-age=3600'
	});
};
