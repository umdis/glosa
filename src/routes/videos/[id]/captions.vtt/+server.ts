import { error } from '@sveltejs/kit';
import { obtenerServicios } from '#lib/server/servicios.js';
import { fragmentosVisibles, obtenerVideo, subtitulosVtt } from '#lib/server/videos.js';
import type { RequestHandler } from './$types';

/** Subtítulos del video, generados de la transcripción visible. */
export const GET: RequestHandler = ({ params }) => {
	const { db } = obtenerServicios();
	if (!obtenerVideo(db, params.id)) error(404, 'Video no encontrado');
	return new Response(subtitulosVtt(fragmentosVisibles(db, params.id)), {
		headers: { 'Content-Type': 'text/vtt; charset=utf-8' }
	});
};
