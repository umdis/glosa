import { fail } from '@sveltejs/kit';
import { preguntar } from '#lib/server/agente/agente.js';
import { crearLimitador, guardarRespuesta, respuestaGuardada } from '#lib/server/agente/limites.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { Actions } from './$types';

/** Seis preguntas cada diez minutos por visitante: suficiente para probar, no para abusar. */
const limitador = crearLimitador(6, 10 * 60_000);

export const actions: Actions = {
	/** Pregunta a la colección. Es POST: cada pregunta cuesta y no debe dispararla un rastreador. */
	default: async ({ request, getClientAddress }) => {
		const formulario = await request.formData();
		const pregunta = String(formulario.get('pregunta') ?? '').trim();
		if (pregunta.length < 3) {
			return fail(400, { pregunta, error: 'Write a question of at least a few words.' });
		}
		if (pregunta.length > 300) {
			return fail(400, { pregunta, error: 'Keep the question under 300 characters.' });
		}

		const { db, meta, topeAlcanzado } = obtenerServicios();
		const guardada = () => respuestaGuardada(db, pregunta);

		if (topeAlcanzado()) {
			const resultado = guardada();
			if (resultado) return { pregunta, resultado, desdeGuardada: true };
			return fail(429, {
				pregunta,
				error:
					'This demo reached its daily question limit. Search still works; questions open again tomorrow.'
			});
		}
		if (!limitador.permitir(getClientAddress())) {
			return fail(429, {
				pregunta,
				error: 'You asked several questions in a row. Wait a few minutes; search still works.'
			});
		}

		try {
			const resultado = await preguntar(db, meta, pregunta);
			guardarRespuesta(db, resultado);
			return { pregunta, resultado, desdeGuardada: false };
		} catch (error) {
			console.error('Falló el agente', error);
			const resultado = guardada();
			if (resultado) return { pregunta, resultado, desdeGuardada: true };
			return fail(502, {
				pregunta,
				error: 'The AI service did not answer. Try again in a moment.'
			});
		}
	}
};
