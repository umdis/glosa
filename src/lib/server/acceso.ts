import { createHash, timingSafeEqual } from 'node:crypto';
import { error, type Cookies } from '@sveltejs/kit';

/** Cookie de sesión del panel. Guarda un resumen de la clave, nunca la clave misma. */
export const COOKIE_ADMIN = 'glosa_admin';

const resumen = (texto: string) => createHash('sha256').update(`glosa-admin:${texto}`).digest();

/** Valor que se guarda en la cookie para una clave dada. */
export function valorSesion(adminToken: string): string {
	return resumen(adminToken).toString('hex');
}

/**
 * Comprueba la clave de administrador en tiempo constante, por cabecera
 * (`Authorization: Bearer <ADMIN_TOKEN>`, para scripts) o por la cookie del panel.
 * Sin ADMIN_TOKEN configurado, nadie es administrador.
 */
export function esAdmin(
	request: Request,
	adminToken: string | undefined,
	cookies?: Pick<Cookies, 'get'>
): boolean {
	if (!adminToken) return false;
	const esperado = resumen(adminToken);

	const cabecera = request.headers.get('authorization') ?? '';
	if (cabecera.startsWith('Bearer ')) {
		return timingSafeEqual(resumen(cabecera.slice(7)), esperado);
	}
	const cookie = cookies?.get(COOKIE_ADMIN);
	if (cookie && /^[0-9a-f]{64}$/.test(cookie)) {
		return timingSafeEqual(Buffer.from(cookie, 'hex'), esperado);
	}
	return false;
}

export function exigirAdmin(
	request: Request,
	adminToken: string | undefined,
	cookies?: Pick<Cookies, 'get'>
): void {
	if (!esAdmin(request, adminToken, cookies)) error(401, 'Se requiere la clave de administrador');
}
