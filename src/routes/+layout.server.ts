import { SHOW_FRAMES } from '$app/env/private';
import { titulosDe } from '#lib/server/investigaciones/datos.js';
import { propias } from '#lib/server/investigaciones/sesion.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { LayoutServerLoad } from './$types';

/**
 * Lo que todas las páginas necesitan saber del servidor. Las investigaciones propias (por la
 * cookie) alimentan «Save to investigation» desde cualquier cita.
 */
export const load: LayoutServerLoad = ({ cookies }) => {
	const ids = propias(cookies);
	return {
		fotogramas: SHOW_FRAMES,
		misInvestigaciones: ids.length ? titulosDe(obtenerServicios().db, ids) : []
	};
};
