import { buscar } from '#lib/server/busqueda/buscar.js';
import {
	etiquetaPorSlug,
	listarEtiquetas,
	videosConEtiqueta
} from '#lib/server/series/etiquetas.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { buscarEnPantalla } from '#lib/server/videos.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const consulta = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const { db } = obtenerServicios();

	// Filtro por etiqueta (spec series-y-etiquetas): solo los videos que la llevan.
	const pedida = url.searchParams.get('tag');
	const encontrada = pedida ? etiquetaPorSlug(db, pedida) : undefined;
	const etiqueta = encontrada ? { slug: encontrada.slug, nombre: encontrada.nombre } : null;
	const etiquetas = listarEtiquetas(db).map((e) => ({ slug: e.slug, nombre: e.nombre }));
	const base = {
		consulta,
		etiqueta,
		etiquetas,
		etiquetaDesconocida: Boolean(pedida && !encontrada)
	};

	if (!consulta) return { ...base, grupos: [], total: 0, enPantalla: [] };

	const videoIds = encontrada ? videosConEtiqueta(db, encontrada.id) : undefined;
	const resultados = buscar(db, consulta, { videoIds });

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

	const permitidos = videoIds ? new Set(videoIds) : undefined;
	return {
		...base,
		grupos: [...grupos.values()],
		total: resultados.length,
		enPantalla: buscarEnPantalla(db, consulta).filter(
			(p) => !permitidos || permitidos.has(p.videoId)
		)
	};
};
