import { json } from '@sveltejs/kit';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { RequestHandler } from './$types';

/** Comprobación de vida para Dokploy: el proceso responde y la base abre. Sin datos internos. */
export const GET: RequestHandler = () => {
	const { db } = obtenerServicios();
	db.prepare('SELECT 1').get();
	return json({ ok: true });
};
