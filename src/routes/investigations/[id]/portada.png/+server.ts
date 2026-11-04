import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { obtenerInvestigacion } from '#lib/server/investigaciones/datos.js';
import { pedidoPortada, rutaPortada } from '#lib/server/investigaciones/portada.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { RequestHandler } from './$types';

/**
 * La portada de una investigación publicada, para `og:image`. Solo se sirve de la caché (nunca
 * se genera aquí) y solo mientras esté publicada: retirar o despublicar la oculta también.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { db, carpetaLaminas } = obtenerServicios();
	const investigacion = /^[a-z2-9]{10}$/.test(params.id)
		? obtenerInvestigacion(db, params.id)
		: undefined;
	if (!investigacion?.publicada || investigacion.retirada) error(404, 'Cover not found');
	let png: Buffer;
	try {
		png = await readFile(rutaPortada(carpetaLaminas, pedidoPortada(db, investigacion, url.origin)));
	} catch {
		error(404, 'Cover not found');
	}
	return new Response(new Uint8Array(png), {
		headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=600' }
	});
};
