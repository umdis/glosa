import { createHash, timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';

/**
 * Comprueba la clave de administrador (`Authorization: Bearer <ADMIN_TOKEN>`) en tiempo
 * constante. Sin ADMIN_TOKEN configurado, nadie es administrador.
 */
export function esAdmin(request: Request, adminToken: string | undefined): boolean {
	if (!adminToken) return false;
	const cabecera = request.headers.get('authorization') ?? '';
	const recibido = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
	// Se comparan resúmenes del mismo largo para no filtrar la longitud de la clave.
	const resumen = (texto: string) => createHash('sha256').update(texto).digest();
	return timingSafeEqual(resumen(recibido), resumen(adminToken));
}

export function exigirAdmin(request: Request, adminToken: string | undefined): void {
	if (!esAdmin(request, adminToken)) error(401, 'Se requiere la clave de administrador');
}
