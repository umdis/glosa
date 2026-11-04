import { json } from '@sveltejs/kit';
import { ADMIN_TOKEN } from '$app/env/private';
import { exigirAdmin } from '#lib/server/acceso.js';
import { consultarYoutube } from '#lib/server/youtube.js';
import type { RequestHandler } from './$types';

/**
 * Título y canal de un enlace de YouTube por oEmbed, para rellenar el formulario de subida (spec
 * origen-youtube). Solo para el editor: no es un proxy abierto hacia YouTube.
 */
export const GET: RequestHandler = async ({ url, request, cookies }) => {
	exigirAdmin(request, ADMIN_TOKEN, cookies);
	const consulta = await consultarYoutube(url.searchParams.get('url') ?? '');
	return consulta.ok ? json(consulta.datos) : json({ error: consulta.error }, { status: 400 });
};
