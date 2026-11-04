import { obtenerServicios } from '#lib/server/servicios.js';
import { listarEtiquetas } from '#lib/server/series/etiquetas.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { db } = obtenerServicios();
	return { etiquetas: listarEtiquetas(db) };
};
