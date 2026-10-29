import { error, type Cookies } from '@sveltejs/kit';
import type { Base } from '../db/base';
import { crearLimitador } from '../agente/limites';
import { obtenerInvestigacion, puedeEditar, type Investigacion } from './datos';
import { secretoDe } from './sesion';

/**
 * Quién puede ver y quién puede editar una investigación (spec investigaciones). Sin el secreto
 * solo se ve si está publicada; si no, es un 404 que no delata que existe.
 */
export function accesoA(
	db: Base,
	id: string,
	cookies: Pick<Cookies, 'get'>
): { investigacion: Investigacion; editable: boolean } {
	const investigacion = /^[a-z2-9]{10}$/.test(id) ? obtenerInvestigacion(db, id) : undefined;
	if (!investigacion) error(404, 'Investigation not found');
	const editable = puedeEditar(db, id, secretoDe(cookies, id));
	if (!editable && !investigacion.publicada) error(404, 'Investigation not found');
	return { investigacion, editable };
}

/** Investigaciones nuevas por visitante: diez al día. */
export const limiteCreacion = crearLimitador(10, 24 * 60 * 60_000);
/** Borradores con Spark por visitante: cinco cada diez minutos (cada uno cuesta). */
export const limiteRedaccion = crearLimitador(5, 10 * 60_000);
/** Cambios por visitante: generoso para escribir, corto para un script. */
export const limiteEdicion = crearLimitador(240, 10 * 60_000);
