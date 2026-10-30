import { fail } from '@sveltejs/kit';
import { atenderPregunta } from '#lib/server/agente/atender.js';
import { referencia } from '#lib/formato.js';
import { indicePublico } from '#lib/server/biblia/indice.js';
import { fichaAprobada } from '#lib/server/revision/resumen.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { listarVideos } from '#lib/server/videos.js';
import type { Actions, PageServerLoad } from './$types';

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
		const atencion = await atenderPregunta(formulario.get('pregunta'), getClientAddress());
		if (!atencion.ok) {
			return fail(atencion.estado, { pregunta: atencion.pregunta, error: atencion.error });
		}
		const { pregunta, resultado, desdeGuardada } = atencion;
		return { pregunta, resultado, desdeGuardada };
	}
};
