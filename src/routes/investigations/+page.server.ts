import { fail, redirect } from '@sveltejs/kit';
import { limiteCreacion, limiteEdicion } from '#lib/server/investigaciones/acceso.js';
import {
	ErrorInvestigacion,
	anadirCita,
	crearInvestigacion,
	puedeEditar
} from '#lib/server/investigaciones/datos.js';
import { recordar, secretoDe } from '#lib/server/investigaciones/sesion.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { Actions, PageServerLoad } from './$types';

/** La lista de las propias sale del layout; aquí no hay nada más que cargar. */
export const load: PageServerLoad = () => ({});

export const actions: Actions = {
	/** Crea una investigación y abre su página de edición. */
	crear: async ({ request, cookies, getClientAddress }) => {
		const titulo = String((await request.formData()).get('titulo') ?? '');
		if (!limiteCreacion.permitir(getClientAddress())) {
			return fail(429, {
				titulo,
				error: 'You created many investigations today. Try again tomorrow.'
			});
		}
		try {
			const { id, secreto } = crearInvestigacion(obtenerServicios().db, titulo);
			recordar(cookies, id, secreto);
			redirect(303, `/investigations/${id}?nueva=1`);
		} catch (e) {
			if (e instanceof ErrorInvestigacion) return fail(400, { titulo, error: e.message });
			throw e;
		}
	},

	/**
	 * Guarda una cita en una investigación propia o en una nueva. Lo usan el diálogo
	 * «Save to investigation» de cualquier pantalla y la página /investigations/save sin JavaScript.
	 */
	guardarCita: async ({ request, cookies, getClientAddress }) => {
		const formulario = await request.formData();
		const fragmentoId = Number(formulario.get('fragmento'));
		const frase = String(formulario.get('frase') ?? '');
		const destino = String(formulario.get('investigacion') ?? '');
		const titulo = String(formulario.get('titulo') ?? '');
		if (!Number.isInteger(fragmentoId)) return fail(400, { error: 'That quote is not valid.' });
		if (!limiteEdicion.permitir(getClientAddress())) {
			return fail(429, { error: 'Too many changes in a row. Wait a few minutes.' });
		}

		const { db } = obtenerServicios();
		try {
			let id = destino;
			if (destino === 'nueva') {
				if (!limiteCreacion.permitir(getClientAddress())) {
					return fail(429, { error: 'You created many investigations today. Use one you have.' });
				}
				// Crear y citar juntos: si la cita no vale, no queda una investigación vacía.
				const creada = db.transaction(() => {
					const nueva = crearInvestigacion(db, titulo);
					anadirCita(db, nueva.id, fragmentoId, frase);
					return nueva;
				})();
				recordar(cookies, creada.id, creada.secreto);
				id = creada.id;
			} else if (!puedeEditar(db, id, secretoDe(cookies, id))) {
				return fail(403, { error: 'You can only save to investigations you can edit.' });
			} else {
				anadirCita(db, id, fragmentoId, frase);
			}
			const { titulo: tituloFinal } = db
				.prepare(`SELECT titulo FROM investigaciones WHERE id = ?`)
				.get(id) as { titulo: string };
			return { guardada: { id, titulo: tituloFinal } };
		} catch (e) {
			if (e instanceof ErrorInvestigacion) return fail(400, { error: e.message });
			throw e;
		}
	}
};
