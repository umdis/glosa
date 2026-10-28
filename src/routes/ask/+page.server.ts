import { fail } from '@sveltejs/kit';
import { preguntar } from '#lib/server/agente/agente.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { Actions } from './$types';

export const actions: Actions = {
	/** Pregunta a la colección. Es POST: cada pregunta cuesta y no debe dispararla un rastreador. */
	default: async ({ request }) => {
		const formulario = await request.formData();
		const pregunta = String(formulario.get('pregunta') ?? '').trim();
		if (pregunta.length < 3) {
			return fail(400, { pregunta, error: 'Write a question of at least a few words.' });
		}
		if (pregunta.length > 300) {
			return fail(400, { pregunta, error: 'Keep the question under 300 characters.' });
		}

		const { db, meta, topeAlcanzado } = obtenerServicios();
		if (topeAlcanzado()) {
			return fail(429, {
				pregunta,
				error:
					'This demo reached its daily question limit. Search still works; questions open again tomorrow.'
			});
		}

		try {
			return { pregunta, resultado: await preguntar(db, meta, pregunta) };
		} catch (error) {
			console.error('Falló el agente', error);
			return fail(502, {
				pregunta,
				error: 'The AI service did not answer. Try again in a moment.'
			});
		}
	}
};
