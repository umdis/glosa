import { fail } from '@sveltejs/kit';
import { preguntar } from '#lib/server/agente/agente.js';
import { crearLimitador, guardarRespuesta, respuestaGuardada } from '#lib/server/agente/limites.js';
import { referencia } from '#lib/formato.js';
import { indicePublico } from '#lib/server/biblia/indice.js';
import { fichaAprobada } from '#lib/server/revision/resumen.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { listarVideos } from '#lib/server/videos.js';
import type { Actions, PageServerLoad } from './$types';

/** Seis preguntas cada diez minutos por visitante: suficiente para probar, no para abusar. */
const limitador = crearLimitador(6, 10 * 60_000);

/**
 * Preguntas de ejemplo armadas con datos de la colección (temas aprobados y pasajes dichos).
 * Nunca con las preguntas guardadas: serían las de otros visitantes.
 */
export const load: PageServerLoad = () => {
	const { db } = obtenerServicios();
	const temas = listarVideos(db).flatMap((v) => fichaAprobada(db, v.id).temas);
	const pasajes = indicePublico(db)
		.flatMap((l) => l.pasajes)
		.filter((p) => p.versiculoInicio !== null && p.momentos.some((m) => m.origen === 'dicho'))
		.map(referencia);
	const temasUnicos = [...new Set([...temas, ...pasajes])];
	return { ejemplos: temasUnicos.slice(0, 3).map((t) => `What was said about ${t}?`) };
};

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
