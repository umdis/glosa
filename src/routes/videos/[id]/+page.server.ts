import { error } from '@sveltejs/kit';
import { referencia } from '#lib/formato.js';
import { pasajesDeVideo } from '#lib/server/biblia/indice.js';
import { segundoPoster } from '#lib/server/fotogramas.js';
import { fichaAprobada } from '#lib/server/revision/resumen.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { fragmentosVisibles, obtenerVideo, textosEnPantalla } from '#lib/server/videos.js';
import type { PageServerLoad } from './$types';

/** Nota al margen de un fragmento: un pasaje citado o lo que apareció escrito en pantalla. */
export type GlosaVideo =
	| { tipo: 'pasaje'; momentoMs: number; referencia: string; origen: 'dicho' | 'en_pantalla' }
	| { tipo: 'pantalla'; momentoMs: number; texto: string };

export const load: PageServerLoad = ({ params, url }) => {
	const { db } = obtenerServicios();
	const video = obtenerVideo(db, params.id);
	if (!video) error(404, 'This video does not exist or is not ready yet.');
	const t = Number(url.searchParams.get('t'));
	const fragmentos = fragmentosVisibles(db, params.id);
	const pasajes = pasajesDeVideo(db, params.id);

	// Cada glosa se ubica junto al fragmento que sonaba en su momento.
	const glosasPorFragmento: Record<number, GlosaVideo[]> = {};
	const ubicar = (momentoMs: number, glosa: GlosaVideo, fragmentoId?: number | null) => {
		const destino =
			fragmentos.find((f) => f.id === fragmentoId) ??
			fragmentos.findLast((f) => f.inicioMs <= momentoMs) ??
			fragmentos[0];
		if (destino) (glosasPorFragmento[destino.id] ??= []).push(glosa);
	};
	for (const p of pasajes) {
		ubicar(
			p.momentoMs,
			{ tipo: 'pasaje', momentoMs: p.momentoMs, referencia: referencia(p), origen: p.origen },
			p.fragmentoId
		);
	}
	for (const p of textosEnPantalla(db, params.id)) {
		ubicar(p.momentoMs, { tipo: 'pantalla', momentoMs: p.momentoMs, texto: p.texto });
	}
	for (const glosas of Object.values(glosasPorFragmento)) {
		glosas.sort((a, b) => a.momentoMs - b.momentoMs);
	}

	return {
		video,
		fragmentos,
		glosasPorFragmento,
		pasajes: pasajes.map((p) => ({
			momentoMs: p.momentoMs,
			referencia: referencia(p),
			origen: p.origen
		})),
		ficha: fichaAprobada(db, params.id),
		posterSegundo: segundoPoster(video.duracionMs),
		inicioSegundos: Number.isFinite(t) && t > 0 ? Math.floor(t) : 0
	};
};
