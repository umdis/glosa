import { fail } from '@sveltejs/kit';
import { timingSafeEqual, createHash } from 'node:crypto';
import { ADMIN_TOKEN } from '$app/env/private';
import { COOKIE_ADMIN, esAdmin, valorSesion } from '#lib/server/acceso.js';
import { segundoPoster } from '#lib/server/fotogramas.js';
import { listarPublicadas, retirar } from '#lib/server/investigaciones/datos.js';
import { decidir, listarPendientes, type Decision } from '#lib/server/revision/decisiones.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { Actions, PageServerLoad } from './$types';

interface FilaVideo {
	id: string;
	titulo: string;
	estado: 'procesando' | 'listo' | 'con_errores';
	duracionMs: number | null;
}

export const load: PageServerLoad = ({ request, cookies }) => {
	if (!esAdmin(request, ADMIN_TOKEN, cookies)) {
		return { autenticado: false as const, configurado: Boolean(ADMIN_TOKEN) };
	}
	const { db, topeAlcanzado } = obtenerServicios();
	const videos = db
		.prepare(
			`SELECT id, titulo, estado, duracion_ms AS duracionMs FROM videos ORDER BY creado_en DESC`
		)
		.all() as FilaVideo[];
	const pasos = db
		.prepare(`SELECT video_id AS videoId, paso, estado, error FROM video_pasos ORDER BY rowid`)
		.all() as Array<{ videoId: string; paso: string; estado: string; error: string | null }>;
	const { gastoHoy } = db
		.prepare(
			`SELECT COALESCE(SUM(costo_usd), 0) AS gastoHoy FROM gasto WHERE momento >= date('now')`
		)
		.get() as { gastoHoy: number };
	return {
		autenticado: true as const,
		videos: videos.map((v) => ({
			...v,
			posterSegundo: segundoPoster(v.duracionMs),
			pasos: pasos.filter((p) => p.videoId === v.id)
		})),
		pendientes: listarPendientes(db),
		publicadas: listarPublicadas(db),
		gastoHoy,
		topeAlcanzado: topeAlcanzado()
	};
};

const igual = (a: string, b: string) => {
	const h = (t: string) => createHash('sha256').update(t).digest();
	return timingSafeEqual(h(a), h(b));
};

export const actions: Actions = {
	entrar: async ({ request, cookies, url }) => {
		const clave = String((await request.formData()).get('clave') ?? '');
		if (!ADMIN_TOKEN || !igual(clave, ADMIN_TOKEN)) {
			return fail(401, { error: 'That key is not right.' });
		}
		cookies.set(COOKIE_ADMIN, valorSesion(ADMIN_TOKEN), {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 12
		});
		return { entrado: true };
	},

	salir: ({ cookies }) => {
		cookies.delete(COOKIE_ADMIN, { path: '/' });
		return { salido: true };
	},

	decidir: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const formulario = await request.formData();
		const id = Number(formulario.get('id'));
		const decision = formulario.get('decision') as Decision;
		if (!Number.isInteger(id) || !['aprobado', 'oculto'].includes(decision)) {
			return fail(400, { error: 'Unknown decision.' });
		}
		const { db } = obtenerServicios();
		if (!decidir(db, id, decision, 'admin')) {
			return fail(409, { error: 'Someone already decided on this item.' });
		}
		return { decidido: id };
	},

	reintentar: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const videoId = String((await request.formData()).get('videoId') ?? '');
		const { db, encolarProcesamiento } = obtenerServicios();
		const video = db.prepare(`SELECT estado FROM videos WHERE id = ?`).get(videoId) as
			{ estado: string } | undefined;
		if (!video || video.estado === 'procesando') {
			return fail(409, { error: 'That video is already being processed.' });
		}
		db.prepare(`UPDATE videos SET estado = 'procesando' WHERE id = ?`).run(videoId);
		encolarProcesamiento(videoId);
		return { reintentado: videoId };
	},

	/** Retira una investigación publicada por un visitante (spec investigaciones: límites). */
	retirar: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const id = String((await request.formData()).get('id') ?? '');
		retirar(obtenerServicios().db, id);
		return { retirada: id };
	}
};
