import { describe, expect, it } from 'vitest';
import { concordancia, duracion, folio } from './formato';

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
