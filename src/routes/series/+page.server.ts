import { obtenerServicios } from '#lib/server/servicios.js';
import { listarSeries } from '#lib/server/series/series.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { db } = obtenerServicios();
	return { series: listarSeries(db) };
};
