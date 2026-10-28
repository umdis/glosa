import { error, json } from '@sveltejs/kit';
import { ADMIN_TOKEN } from '$app/env/private';
import { exigirAdmin } from '#lib/server/acceso.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { RequestHandler } from './$types';

/** Vuelve a encolar el video: solo se ejecutan los pasos que no están hechos. */
export const POST: RequestHandler = ({ request, params, cookies }) => {
	exigirAdmin(request, ADMIN_TOKEN, cookies);
	const { db, encolarProcesamiento } = obtenerServicios();
	const video = db.prepare(`SELECT estado FROM videos WHERE id = ?`).get(params.id) as
		{ estado: string } | undefined;
	if (!video) error(404, 'Video no encontrado');
	if (video.estado === 'procesando') error(409, 'El video ya se está procesando');
	// Se marca ya, no al salir de la cola, para que un segundo reintento reciba el 409.
	db.prepare(`UPDATE videos SET estado = 'procesando' WHERE id = ?`).run(params.id);
	encolarProcesamiento(params.id);
	return json({ id: params.id, estado: 'procesando' }, { status: 202 });
};
