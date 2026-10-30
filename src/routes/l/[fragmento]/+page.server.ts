import { fail } from '@sveltejs/kit';
import { crearLimitador } from '#lib/server/agente/limites.js';
import { ColaLlena, existe } from '#lib/server/clips/generar.js';
import { rutaLamina } from '#lib/server/laminas/lamina.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { pedidoLamina } from './pedido';
import type { Actions, PageServerLoad } from './$types';

/** Láminas nuevas por visitante: diez al día. Las que ya existen se sirven sin límite. */
const limiteLaminas = crearLimitador(10, 24 * 60 * 60_000);

export const load: PageServerLoad = async ({ params, url }) => {
	const pedido = pedidoLamina(params.fragmento, url);
	return {
		...pedido,
		listo: await existe(rutaLamina(obtenerServicios().carpetaLaminas, pedido.clave)),
		origen: url.origin
	};
};

export const actions: Actions = {
	/** Genera la lámina (ilustración de Muse Image y composición). Solo por POST: cuesta. */
	default: async ({ params, url, getClientAddress }) => {
		const { carpetaLaminas, lamina, topeAlcanzado } = obtenerServicios();
		const pedido = pedidoLamina(params.fragmento, url);
		if (await existe(rutaLamina(carpetaLaminas, pedido.clave))) return { listo: true };
		if (topeAlcanzado()) {
			return fail(429, { error: 'This demo reached its daily limit. Cards open again tomorrow.' });
		}
		if (!limiteLaminas.permitir(getClientAddress())) {
			return fail(429, { error: 'You made many cards today. Cards already made still open.' });
		}
		try {
			await lamina(pedido);
			return { listo: true };
		} catch (e) {
			if (e instanceof ColaLlena) {
				return fail(503, { error: 'Glosa is busy making other cards. Try again in a minute.' });
			}
			console.error('Falló la lámina', e);
			return fail(500, { error: 'The card could not be made. Try again in a moment.' });
		}
	}
};
