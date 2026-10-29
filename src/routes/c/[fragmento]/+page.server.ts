import { error, fail } from '@sveltejs/kit';
import { join } from 'node:path';
import { SHOW_FRAMES } from '$app/env/private';
import { crearLimitador } from '#lib/server/agente/limites.js';
import { ColaLlena, existe, pedidoClip } from '#lib/server/clips/generar.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { Actions, PageServerLoad } from './$types';

/** Clips nuevos por visitante: diez al día. Los que ya existen se sirven sin límite. */
const limiteClips = crearLimitador(10, 24 * 60 * 60_000);

function pedidoDe(fragmento: string) {
	const id = Number(fragmento);
	if (!Number.isInteger(id)) error(404, 'Clip not found');
	const pedido = pedidoClip(obtenerServicios().db, id, SHOW_FRAMES);
	if (!pedido) error(404, 'This moment cannot be made into a clip.');
	return pedido;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const { carpetaMedios } = obtenerServicios();
	const pedido = pedidoDe(params.fragmento);
	const listo = await existe(join(carpetaMedios, pedido.videoId, 'clips', pedido.archivo));
	return {
		fragmentoId: pedido.ventana.citado.id,
		frase: pedido.ventana.citado.texto,
		video: { id: pedido.videoId, titulo: pedido.titulo },
		inicioMs: pedido.ventana.citado.inicioMs,
		duracionMs: pedido.ventana.finMs - pedido.ventana.inicioMs,
		listo,
		origen: url.origin
	};
};

export const actions: Actions = {
	/** Genera el clip. Tarda unos segundos; la persona espera con el progreso a la vista. */
	default: async ({ params, getClientAddress }) => {
		const { carpetaMedios, clip } = obtenerServicios();
		const pedido = pedidoDe(params.fragmento);
		if (await existe(join(carpetaMedios, pedido.videoId, 'clips', pedido.archivo))) {
			return { listo: true };
		}
		if (!limiteClips.permitir(getClientAddress())) {
			return fail(429, { error: 'You made many clips today. Clips already made still play.' });
		}
		try {
			await clip(pedido);
			return { listo: true };
		} catch (e) {
			if (e instanceof ColaLlena) {
				return fail(503, { error: 'Glosa is busy making other clips. Try again in a minute.' });
			}
			console.error('Falló el clip', e);
			return fail(500, { error: 'The clip could not be made. Try again in a moment.' });
		}
	}
};
