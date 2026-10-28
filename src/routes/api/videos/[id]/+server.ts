import { error, json } from '@sveltejs/kit';
import { ADMIN_TOKEN } from '$app/env/private';
import { exigirAdmin } from '#lib/server/acceso.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { RequestHandler } from './$types';

/** Estado del procesamiento de un video, paso por paso (solo administrador). */
export const GET: RequestHandler = ({ request, params, cookies }) => {
	exigirAdmin(request, ADMIN_TOKEN, cookies);
	const { db } = obtenerServicios();
	const video = db
		.prepare(`SELECT id, titulo, estado, duracion_ms AS duracionMs FROM videos WHERE id = ?`)
		.get(params.id);
	if (!video) error(404, 'Video no encontrado');
	const pasos = db
		.prepare(
			`SELECT paso, estado, error, actualizado_en AS actualizadoEn
			 FROM video_pasos WHERE video_id = ? ORDER BY rowid`
		)
		.all(params.id);
	const { fragmentos } = db
		.prepare(`SELECT COUNT(*) AS fragmentos FROM fragmentos WHERE video_id = ?`)
		.get(params.id) as { fragmentos: number };
	return json({ ...video, fragmentos, pasos });
};
