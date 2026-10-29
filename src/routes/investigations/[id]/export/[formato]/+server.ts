import { error } from '@sveltejs/kit';
import { accesoA } from '#lib/server/investigaciones/acceso.js';
import { bloquesDe } from '#lib/server/investigaciones/datos.js';
import { aMarkdown, aWord, nombreArchivo } from '#lib/server/investigaciones/exportar.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { RequestHandler } from './$types';

/** Descarga la investigación en Markdown o en Word. Mismo acceso que la página. */
export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const { db } = obtenerServicios();
	const { investigacion } = accesoA(db, params.id, cookies);
	const bloques = bloquesDe(db, params.id);
	const cabeceras = (tipo: string, extension: string) => ({
		'Content-Type': tipo,
		'Content-Disposition': `attachment; filename="${nombreArchivo(investigacion.titulo, extension)}"`,
		'Cache-Control': 'private, no-store'
	});

	if (params.formato === 'md') {
		return new Response(aMarkdown(investigacion, bloques, url.origin), {
			headers: cabeceras('text/markdown; charset=utf-8', 'md')
		});
	}
	if (params.formato === 'docx') {
		const buffer = await aWord(investigacion, bloques, url.origin);
		return new Response(new Uint8Array(buffer), {
			headers: cabeceras(
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'docx'
			)
		});
	}
	error(404, 'Unknown format');
};
