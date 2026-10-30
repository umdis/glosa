import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { rutaLamina } from '#lib/server/laminas/lamina.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { RequestHandler } from './$types';

/** La lámina ya hecha. Solo se sirve de la caché: aquí nunca se genera ni se gasta. */
export const GET: RequestHandler = async ({ params, url }) => {
	if (
		!/^\d+-[0-9a-f]{16}$/.test(params.clave) ||
		!params.clave.startsWith(`${params.fragmento}-`)
	) {
		error(404, 'Card not found');
	}
	let png: Buffer;
	try {
		png = await readFile(rutaLamina(obtenerServicios().carpetaLaminas, params.clave));
	} catch {
		error(404, 'Card not found');
	}
	const descargar = url.searchParams.has('descargar');
	return new Response(new Uint8Array(png), {
		headers: {
			'content-type': 'image/png',
			'cache-control': 'public, max-age=86400',
			...(descargar
				? { 'content-disposition': `attachment; filename="glosa-${params.clave}.png"` }
				: {})
		}
	});
};
