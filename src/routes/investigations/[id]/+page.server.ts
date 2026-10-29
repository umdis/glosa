import { error, fail, redirect } from '@sveltejs/kit';
import { accesoA, limiteEdicion, limiteRedaccion } from '#lib/server/investigaciones/acceso.js';
import {
	ErrorInvestigacion,
	anadirTexto,
	bloquesDe,
	borrarBloque,
	editarBloque,
	moverBloque,
	publicar,
	puedeEditar,
	renombrar,
	type TipoBloque
} from '#lib/server/investigaciones/datos.js';
import { redactarSeccion } from '#lib/server/investigaciones/redactar.js';
import { olvidar, recordar, secretoDe } from '#lib/server/investigaciones/sesion.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = ({ params, url, cookies }) => {
	const { db, topeAlcanzado } = obtenerServicios();

	// Abrir el enlace de edición: el secreto pasa a la cookie y sale de la URL (design.md D1).
	const clave = url.searchParams.get('k');
	if (clave !== null) {
		if (puedeEditar(db, params.id, clave)) recordar(cookies, params.id, clave);
		redirect(303, `/investigations/${params.id}`);
	}

	const { investigacion, editable } = accesoA(db, params.id, cookies);
	const secreto = editable ? secretoDe(cookies, params.id) : undefined;
	return {
		investigacion,
		bloques: bloquesDe(db, params.id),
		editable,
		// Solo quien ya puede editar recibe el enlace de edición, para guardarlo o llevárselo.
		enlaceEdicion: secreto ? `${url.origin}/investigations/${params.id}?k=${secreto}` : null,
		enlaceLectura: `${url.origin}/investigations/${params.id}`,
		nueva: editable && url.searchParams.has('nueva'),
		redaccionDisponible: editable && !topeAlcanzado()
	};
};

/**
 * Envuelve cada acción de edición: exige el secreto, aplica el límite y convierte los errores
 * esperables en mensajes para la persona.
 */
function editar<T>(
	accion: (contexto: { id: string; formulario: FormData; evento: RequestEvent }) => T | Promise<T>
) {
	return async (evento: RequestEvent) => {
		const { db } = obtenerServicios();
		const { editable } = accesoA(db, evento.params.id, evento.cookies);
		if (!editable) error(403, 'You can only change investigations you can edit.');
		if (!limiteEdicion.permitir(evento.getClientAddress())) {
			return fail(429, { error: 'Too many changes in a row. Wait a few minutes.' });
		}
		const formulario = await evento.request.formData();
		try {
			return await accion({ id: evento.params.id, formulario, evento });
		} catch (e) {
			if (e instanceof ErrorInvestigacion) return fail(400, { error: e.message });
			throw e;
		}
	};
}

const bloqueDe = (formulario: FormData) => {
	const id = Number(formulario.get('bloque'));
	if (!Number.isInteger(id)) throw new ErrorInvestigacion('That block no longer exists.');
	return id;
};

export const actions: Actions = {
	renombrar: editar(({ id, formulario }) => {
		renombrar(obtenerServicios().db, id, String(formulario.get('titulo') ?? ''));
		return { aviso: 'Title saved.' };
	}),

	anadir: editar(({ id, formulario }) => {
		const tipo = String(formulario.get('tipo')) as TipoBloque;
		if (!['titulo', 'texto', 'nota'].includes(tipo))
			throw new ErrorInvestigacion('Choose a heading, a paragraph or a note.');
		const bloque = anadirTexto(
			obtenerServicios().db,
			id,
			tipo as 'titulo' | 'texto' | 'nota',
			String(formulario.get('texto') ?? '')
		);
		return { aviso: 'Block added at the end.', enfocar: bloque };
	}),

	editar: editar(({ id, formulario }) => {
		const bloque = bloqueDe(formulario);
		editarBloque(obtenerServicios().db, id, bloque, String(formulario.get('texto') ?? ''));
		return { aviso: 'Block saved.', enfocar: bloque };
	}),

	borrar: editar(({ id, formulario }) => {
		const { db } = obtenerServicios();
		const bloque = bloqueDe(formulario);
		// El foco pasa al bloque siguiente (o al anterior si era el último), no al vacío.
		const ids = bloquesDe(db, id).map((b) => b.id);
		const i = ids.indexOf(bloque);
		const vecino = ids[i + 1] ?? ids[i - 1];
		borrarBloque(db, id, bloque);
		return { aviso: 'Block deleted.', enfocar: vecino };
	}),

	mover: editar(({ id, formulario }) => {
		const bloque = bloqueDe(formulario);
		const direccion = formulario.get('direccion') === 'arriba' ? 'arriba' : 'abajo';
		const { posicion, total } = moverBloque(obtenerServicios().db, id, bloque, direccion);
		return {
			aviso: `Moved to position ${posicion} of ${total}.`,
			enfocar: bloque,
			direccion
		};
	}),

	publicar: editar(({ id, formulario }) => {
		const valor = formulario.get('publicada') === '1';
		publicar(obtenerServicios().db, id, valor);
		return {
			aviso: valor
				? 'Published. Anyone with the read link can see it.'
				: 'Unpublished. Only people with the edit link can see it.'
		};
	}),

	/** Deja de recordar la investigación en este navegador (no la borra). */
	olvidar: async ({ params, cookies }) => {
		olvidar(cookies, params.id);
		redirect(303, '/investigations');
	},

	redactar: editar(async ({ id, formulario, evento }) => {
		const { db, meta, topeAlcanzado } = obtenerServicios();
		if (topeAlcanzado()) {
			return fail(429, {
				error: 'This demo reached its daily AI limit. Writing and exporting still work.'
			});
		}
		if (!limiteRedaccion.permitir(evento.getClientAddress())) {
			return fail(429, { error: 'You asked for several drafts in a row. Wait a few minutes.' });
		}
		const pedido = String(formulario.get('pedido') ?? '')
			.trim()
			.slice(0, 200);
		const { investigacion } = accesoA(db, id, evento.cookies);
		try {
			const r = await redactarSeccion(db, meta, investigacion, pedido);
			const descartadas = r.descartadas
				? ` ${r.descartadas} ${r.descartadas === 1 ? 'quote was' : 'quotes were'} left out because ${r.descartadas === 1 ? 'it' : 'they'} did not match the transcript.`
				: '';
			return {
				aviso: `Muse Spark added ${r.bloques} ${r.bloques === 1 ? 'block' : 'blocks'} and ${r.citas} verified ${r.citas === 1 ? 'quote' : 'quotes'} at the end.${descartadas}`
			};
		} catch (e) {
			if (e instanceof ErrorInvestigacion) throw e;
			console.error('Falló la redacción', e);
			return fail(502, { error: 'The AI service did not answer. Try again in a moment.' });
		}
	})
};
