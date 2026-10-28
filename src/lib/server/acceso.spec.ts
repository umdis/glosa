import { describe, expect, it } from 'vitest';
import { esAdmin } from './acceso';

const peticion = (autorizacion?: string) =>
	new Request('http://glosa.test/api/videos', {
		headers: autorizacion ? { authorization: autorizacion } : {}
	});

describe('esAdmin', () => {
	it('acepta solo la clave exacta con el esquema Bearer', () => {
		expect(esAdmin(peticion('Bearer secreta'), 'secreta')).toBe(true);
		expect(esAdmin(peticion('Bearer otra'), 'secreta')).toBe(false);
		expect(esAdmin(peticion('secreta'), 'secreta')).toBe(false);
		expect(esAdmin(peticion(), 'secreta')).toBe(false);
	});

	it('sin ADMIN_TOKEN configurado no hay administrador posible', () => {
		expect(esAdmin(peticion('Bearer '), undefined)).toBe(false);
		expect(esAdmin(peticion('Bearer '), '')).toBe(false);
	});
});
