import { describe, expect, it } from 'vitest';
import {
	capituloYVersiculo,
	concordancia,
	contiene,
	duracion,
	folio,
	referencia,
	resaltar
} from './formato';

describe('folio', () => {
	it('compone minutos y, pasada la hora, horas', () => {
		expect(folio(383_400)).toBe('6:23');
		expect(folio(3_723_000)).toBe('1:02:03');
		expect(folio(-5)).toBe('0:00');
	});
});

describe('duracion', () => {
	it('redondea a minutos y usa horas desde 60', () => {
		expect(duracion(2_590_821)).toBe('43 min');
		expect(duracion(4_131_941)).toBe('1 h 9 min');
		expect(duracion(null)).toBe('');
	});
});

describe('concordancia', () => {
	const texto = 'en el versículo dos dice hermanos míos tened por sumo gozo cuando os halléis';

	it('separa la palabra clave de su contexto', () => {
		const inicio = texto.indexOf('gozo');
		expect(concordancia(texto, [[inicio, inicio + 4]])).toEqual({
			antes: 'en el versículo dos dice hermanos míos tened por sumo ',
			clave: 'gozo',
			despues: ' cuando os halléis'
		});
	});

	it('recorta el contexto por palabras completas', () => {
		const inicio = texto.indexOf('gozo');
		const { antes } = concordancia(texto, [[inicio, inicio + 4]], 20);
		expect(antes).toBe('…tened por sumo ');
	});
});

describe('resaltar y contiene', () => {
	it('marca la palabra sin importar tildes ni mayúsculas y conserva el original', () => {
		expect(resaltar('La Tentación y la tentacion', 'tentación')).toEqual([
			{ texto: 'La ', marca: false },
			{ texto: 'Tentación', marca: true },
			{ texto: ' y la ', marca: false },
			{ texto: 'tentacion', marca: true }
		]);
		expect(contiene('Corazón', 'CORAZON')).toBe(true);
		expect(contiene('Corazón', '  ')).toBe(false);
	});

	it('sin consulta devuelve el texto entero', () => {
		expect(resaltar('Hermanos', '')).toEqual([{ texto: 'Hermanos', marca: false }]);
	});
});

describe('referencia', () => {
	it('compone libro, capítulo y versículos', () => {
		const base = { libro: 'Deuteronomio', capitulo: 6, versiculoInicio: 6, versiculoFin: 9 };
		expect(referencia(base)).toBe('Deuteronomio 6:6–9');
		expect(referencia({ ...base, versiculoFin: 6 })).toBe('Deuteronomio 6:6');
		expect(capituloYVersiculo({ capitulo: 6, versiculoInicio: null, versiculoFin: null })).toBe(
			'6'
		);
	});
});
