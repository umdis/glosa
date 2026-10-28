import { error } from '@sveltejs/kit';
import { obtenerServicios } from '#lib/server/servicios.js';
import { fragmentosVisibles, obtenerVideo } from '#lib/server/videos.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const { db } = obtenerServicios();
	const video = obtenerVideo(db, params.id);
	if (!video) error(404, 'This video does not exist or is not ready yet.');
	const t = Number(url.searchParams.get('t'));
	return {
		video,
		fragmentos: fragmentosVisibles(db, params.id),
		inicioSegundos: Number.isFinite(t) && t > 0 ? Math.floor(t) : 0
	};
};
