import { obtenerServicios } from '#lib/server/servicios.js';
import { listarVideos } from '#lib/server/videos.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { db } = obtenerServicios();
	return { videos: listarVideos(db) };
};
