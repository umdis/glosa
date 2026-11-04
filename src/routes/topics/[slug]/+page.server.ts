import { error } from '@sveltejs/kit';
import { obtenerServicios } from '#lib/server/servicios.js';
import { listarEtiquetas } from '#lib/server/series/etiquetas.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const { db } = obtenerServicios();
	const etiqueta = listarEtiquetas(db).find((e) => e.slug === params.slug);
	if (!etiqueta) error(404, 'That topic does not exist.');
	return { etiqueta };
};
