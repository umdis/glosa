import { indicePublico, testamento } from '#lib/server/biblia/indice.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { db } = obtenerServicios();
	return { libros: indicePublico(db).map((l) => ({ ...l, testamento: testamento(l.libro) })) };
};
