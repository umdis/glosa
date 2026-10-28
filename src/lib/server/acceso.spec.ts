import { describe, expect, it } from 'vitest';
import { COOKIE_ADMIN, esAdmin, valorSesion } from './acceso';

const peticion = (autorizacion?: string) =>
	new Request('http://glosa.test/api/videos', {
		headers: autorizacion ? { authorization: autorizacion } : {}
	});
const galletas = (valor?: string) => ({
	get: (nombre: string) => (nombre === COOKIE_ADMIN ? valor : undefined)
});

describe('esAdmin', () => {
	it('acepta solo la clave exacta con el esquema Bearer', () => {
		expect(esAdmin(peticion('Bearer secreta'), 'secreta')).toBe(true);
		expect(esAdmin(peticion('Bearer otra'), 'secreta')).toBe(false);
		expect(esAdmin(peticion('secreta'), 'secreta')).toBe(false);
		expect(esAdmin(peticion(), 'secreta')).toBe(false);
	});

	it('acepta la cookie del panel, que no contiene la clave', () => {
		const valor = valorSesion('secreta');
		expect(valor).not.toContain('secreta');
		expect(esAdmin(peticion(), 'secreta', galletas(valor))).toBe(true);
		expect(esAdmin(peticion(), 'secreta', galletas(valorSesion('otra')))).toBe(false);
		expect(esAdmin(peticion(), 'secreta', galletas('no-hex'))).toBe(false);
	});

	it('una cookie vieja deja de valer si cambia la clave', () => {
		expect(esAdmin(peticion(), 'nueva', galletas(valorSesion('vieja')))).toBe(false);
	});

	it('sin ADMIN_TOKEN configurado no hay administrador posible', () => {
		expect(esAdmin(peticion('Bearer '), undefined)).toBe(false);
		expect(esAdmin(peticion(), '', galletas(valorSesion('')))).toBe(false);
	});
});
