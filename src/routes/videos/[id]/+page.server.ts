import { error } from '@sveltejs/kit';
import { fichaAprobada } from '#lib/server/revision/resumen.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { fragmentosVisibles, obtenerVideo, textosEnPantalla } from '#lib/server/videos.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const { db } = obtenerServicios();
	const video = obtenerVideo(db, params.id);
	if (!video) error(404, 'This video does not exist or is not ready yet.');
	const t = Number(url.searchParams.get('t'));
	const fragmentos = fragmentosVisibles(db, params.id);

	// Cada texto en pantalla se ubica tras el fragmento que sonaba cuando apareció.
	const pantallaPorFragmento: Record<number, Array<{ momentoMs: number; texto: string }>> = {};
	for (const p of textosEnPantalla(db, params.id)) {
		const anterior = fragmentos.findLast((f) => f.inicioMs <= p.momentoMs) ?? fragmentos[0];
		if (!anterior) continue;
		(pantallaPorFragmento[anterior.id] ??= []).push({ momentoMs: p.momentoMs, texto: p.texto });
	}

	return {
		video,
		fragmentos,
		pantallaPorFragmento,
		ficha: fichaAprobada(db, params.id),
		inicioSegundos: Number.isFinite(t) && t > 0 ? Math.floor(t) : 0
	};
};
