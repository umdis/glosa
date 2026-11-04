import { fail } from '@sveltejs/kit';
import { timingSafeEqual, createHash } from 'node:crypto';
import { ADMIN_TOKEN } from '$app/env/private';
import { COOKIE_ADMIN, esAdmin, valorSesion } from '#lib/server/acceso.js';
import { segundoPoster } from '#lib/server/fotogramas.js';
import { listarPublicadas, retirar } from '#lib/server/investigaciones/datos.js';
import { decidir, listarPendientes, type Decision } from '#lib/server/revision/decisiones.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { fijarPrivacidadVisual } from '#lib/server/videos.js';
import { consultarYoutube } from '#lib/server/youtube.js';
import { fusionarEtiquetas, todasLasEtiquetas } from '#lib/server/series/etiquetas.js';
import {
	asignarVideos,
	borrarSerie,
	crearSerie,
	decidirResumenSerie,
	editarSerie,
	idsDeSerie,
	listarSeries,
	proponerResumenSerie,
	resumenesPendientes
} from '#lib/server/series/series.js';
import {
	avanceSubtitulos,
	subtitular,
	subtitulandoAhora
} from '#lib/server/traduccion/subtitulos.js';
import type { Actions, PageServerLoad } from './$types';

interface FilaVideo {
	id: string;
	titulo: string;
	estado: 'procesando' | 'listo' | 'con_errores';
	duracionMs: number | null;
	privacidadVisual: number;
	youtubeUrl: string | null;
	youtubeCanal: string | null;
}

export const load: PageServerLoad = ({ request, cookies }) => {
	if (!esAdmin(request, ADMIN_TOKEN, cookies)) {
		return { autenticado: false as const, configurado: Boolean(ADMIN_TOKEN) };
	}
	const { db, topeAlcanzado } = obtenerServicios();
	const videos = db
		.prepare(
			`SELECT id, titulo, estado, duracion_ms AS duracionMs, privacidad_visual AS privacidadVisual,
				youtube_url AS youtubeUrl, youtube_canal AS youtubeCanal
			 FROM videos ORDER BY creado_en DESC`
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
			pasos: pasos.filter((p) => p.videoId === v.id),
			subtitulosEn: { ...avanceSubtitulos(db, v.id, 'en'), enCurso: subtitulandoAhora(v.id, 'en') }
		})),
		pendientes: listarPendientes(db),
		publicadas: listarPublicadas(db),
		series: listarSeries(db, { conVacias: true }).map((s) => ({
			id: s.id,
			nombre: s.nombre,
			descripcion: s.descripcion,
			videoIds: idsDeSerie(db, s.id),
			tieneResumen: s.resumen !== null
		})),
		resumenesSerie: resumenesPendientes(db),
		etiquetas: todasLasEtiquetas(db),
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

	/** Subtítulos en inglés de un video, en segundo plano (spec idiomas-y-voz). */
	subtitular: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const videoId = String((await request.formData()).get('videoId') ?? '');
		const { db, meta, topeAlcanzado } = obtenerServicios();
		if (!db.prepare(`SELECT 1 FROM videos WHERE id = ?`).get(videoId)) {
			return fail(404, { error: 'That video does not exist.' });
		}
		if (topeAlcanzado()) return fail(429, { error: 'The daily spending cap was reached.' });
		subtitular(db, meta, videoId, 'en');
		return { subtitulando: videoId };
	},

	/** Activa o apaga la privacidad visual de un video (spec privacidad-visual). */
	privacidad: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const formulario = await request.formData();
		const videoId = String(formulario.get('videoId') ?? '');
		const activa = formulario.get('activa') === '1';
		if (!fijarPrivacidadVisual(obtenerServicios().db, videoId, activa)) {
			return fail(404, { error: 'That video does not exist.' });
		}
		return { privacidad: videoId };
	},

	/**
	 * Enlaza un video con su publicación en YouTube, o quita el enlace si llega vacío (spec
	 * origen-youtube). Solo se guarda el enlace canónico y el canal; el título no se toca.
	 */
	youtube: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const formulario = await request.formData();
		const videoId = String(formulario.get('videoId') ?? '');
		const enlace = String(formulario.get('youtube') ?? '').trim();
		const { db } = obtenerServicios();
		if (!db.prepare(`SELECT 1 FROM videos WHERE id = ?`).get(videoId)) {
			return fail(404, { error: 'That video does not exist.' });
		}
		if (!enlace) {
			db.prepare(`UPDATE videos SET youtube_url = NULL, youtube_canal = NULL WHERE id = ?`).run(
				videoId
			);
			return { youtube: videoId };
		}
		const consulta = await consultarYoutube(enlace);
		if (!consulta.ok) return fail(400, { error: consulta.error });
		db.prepare(`UPDATE videos SET youtube_url = ?, youtube_canal = ? WHERE id = ?`).run(
			consulta.datos.url,
			consulta.datos.canal,
			videoId
		);
		return { youtube: videoId };
	},

	/** Crea una serie (spec series-y-etiquetas). */
	crearSerie: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const formulario = await request.formData();
		const serie = crearSerie(
			obtenerServicios().db,
			String(formulario.get('nombre') ?? ''),
			String(formulario.get('descripcion') ?? '')
		);
		if (!serie) return fail(400, { error: 'Give the series a name.' });
		return { serieCreada: serie.id };
	},

	/**
	 * Nombre, descripción y videos de una serie. Cada video marcado lleva su número de parte;
	 * los que no lo tienen van al final, en el orden de la lista.
	 */
	guardarSerie: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const formulario = await request.formData();
		const id = String(formulario.get('id') ?? '');
		const { db } = obtenerServicios();
		const nombre = String(formulario.get('nombre') ?? '');
		if (!editarSerie(db, id, nombre, String(formulario.get('descripcion') ?? ''))) {
			return fail(400, { error: 'Give the series a name.' });
		}
		const marcados = formulario.getAll('video').map(String);
		const parte = (videoId: string) => {
			const n = Number(formulario.get(`parte-${videoId}`));
			return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
		};
		const ordenados = marcados
			.map((v, i) => ({ v, i, p: parte(v) }))
			.sort((a, b) => a.p - b.p || a.i - b.i)
			.map((x) => x.v);
		asignarVideos(db, id, ordenados);
		return { serieGuardada: id };
	},

	borrarSerie: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const id = String((await request.formData()).get('id') ?? '');
		borrarSerie(obtenerServicios().db, id);
		return { serieBorrada: id };
	},

	/** Pide a Muse Spark el resumen de la serie; queda pendiente en la cola de revisión. */
	resumirSerie: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const id = String((await request.formData()).get('id') ?? '');
		const { db, meta, topeAlcanzado } = obtenerServicios();
		if (topeAlcanzado()) return fail(429, { error: 'The daily spending cap was reached.' });
		try {
			const resumen = await proponerResumenSerie(db, meta, id);
			if (resumen === null) {
				return fail(409, {
					error: 'Approve the summary of at least one video of the series first.'
				});
			}
		} catch (error) {
			console.error('Falló el resumen de la serie', error);
			return fail(502, { error: 'Muse Spark did not answer. Try again in a moment.' });
		}
		return { serieResumida: id };
	},

	decidirResumenSerie: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const formulario = await request.formData();
		const id = Number(formulario.get('id'));
		const decision = formulario.get('decision');
		if (!Number.isInteger(id) || (decision !== 'aprobado' && decision !== 'oculto')) {
			return fail(400, { error: 'Unknown decision.' });
		}
		if (!decidirResumenSerie(obtenerServicios().db, id, decision, 'admin')) {
			return fail(409, { error: 'Someone already decided on this item.' });
		}
		return { decidido: id };
	},

	/** Fusiona dos etiquetas equivalentes: la primera pasa a la segunda. */
	fusionarEtiquetas: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const formulario = await request.formData();
		const absorbida = Number(formulario.get('absorbida'));
		const destino = Number(formulario.get('destino'));
		if (!fusionarEtiquetas(obtenerServicios().db, absorbida, destino)) {
			return fail(400, { error: 'Choose two different topics.' });
		}
		return { fusionadas: destino };
	},

	/** Retira una investigación publicada por un visitante (spec investigaciones: límites). */
	retirar: async ({ request, cookies }) => {
		if (!esAdmin(request, ADMIN_TOKEN, cookies)) return fail(401, { error: 'Sign in again.' });
		const id = String((await request.formData()).get('id') ?? '');
		retirar(obtenerServicios().db, id);
		return { retirada: id };
	}
};
