import { buscar } from '#lib/server/busqueda/buscar.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { buscarEnPantalla } from '#lib/server/videos.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const consulta = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	if (!consulta) return { consulta, grupos: [], total: 0, enPantalla: [] };

	const { db } = obtenerServicios();
	const resultados = buscar(db, consulta);

	// Agrupados por video, en el orden del primer resultado de cada uno (el más relevante).
	const grupos = new Map<
		string,
		{ videoId: string; titulo: string; momentos: typeof resultados }
	>();
	for (const r of resultados) {
		const grupo = grupos.get(r.videoId) ?? { videoId: r.videoId, titulo: r.titulo, momentos: [] };
		grupo.momentos.push(r);
		grupos.set(r.videoId, grupo);
	}
	for (const grupo of grupos.values()) grupo.momentos.sort((a, b) => a.inicioMs - b.inicioMs);

	return {
		consulta,
		grupos: [...grupos.values()],
		total: resultados.length,
		enPantalla: buscarEnPantalla(db, consulta)
	};
};
