import { describe, expect, it } from 'vitest';
import {
	COOKIE_CUADERNOS,
	MAXIMO_RECORDADAS,
	olvidar,
	propias,
	recordar,
	secretoDe
} from './sesion';

function cookiesFalsas(inicial?: string) {
	const almacen = new Map<string, string>(inicial ? [[COOKIE_CUADERNOS, inicial]] : []);
	const opciones: Array<Record<string, unknown>> = [];
	return {
		get: (nombre: string) => almacen.get(nombre),
		set: (nombre: string, valor: string, o: Record<string, unknown>) => {
			almacen.set(nombre, valor);
			opciones.push(o);
		},
		opciones
	};
}

const secreto = (letra: string) => letra.repeat(43);

describe('cookie de investigaciones', () => {
	it('recuerda la más reciente primero, sin duplicados, httpOnly y en toda la web', () => {
		const c = cookiesFalsas();
		recordar(c, 'aaaaaaaaaa', secreto('A'));
		recordar(c, 'bbbbbbbbbb', secreto('B'));
		recordar(c, 'aaaaaaaaaa', secreto('A'));
		expect(propias(c)).toEqual(['aaaaaaaaaa', 'bbbbbbbbbb']);
		expect(secretoDe(c, 'bbbbbbbbbb')).toBe(secreto('B'));
		expect(c.opciones.at(-1)).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax' });
	});

	it('ignora pares mal formados y no pasa del máximo', () => {
		const c = cookiesFalsas('basura|xx.yy|cccccccccc.' + secreto('C'));
		expect(propias(c)).toEqual(['cccccccccc']);
		const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
		for (let i = 0; i < MAXIMO_RECORDADAS + 5; i++)
			recordar(c, alfabeto[i].repeat(10), secreto('D'));
		expect(propias(c)).toHaveLength(MAXIMO_RECORDADAS);
	});

	it('olvida una investigación', () => {
		const c = cookiesFalsas();
		recordar(c, 'aaaaaaaaaa', secreto('A'));
		olvidar(c, 'aaaaaaaaaa');
		expect(propias(c)).toEqual([]);
	});
});
