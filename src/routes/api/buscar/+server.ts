import { error, json } from '@sveltejs/kit';
import { buscar } from '#lib/server/busqueda/buscar.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { RequestHandler } from './$types';

/** Búsqueda pública por lo dicho. Solo devuelve contenido visible (aprobado). */
export const GET: RequestHandler = ({ url }) => {
	const consulta = url.searchParams.get('q')?.trim() ?? '';
	if (consulta.length > 200) error(400, 'La búsqueda es demasiado larga');
	const videoId = url.searchParams.get('video') ?? undefined;
	const { db } = obtenerServicios();
	return json({ consulta, resultados: consulta ? buscar(db, consulta, { videoId }) : [] });
};
