import { describe, expect, it } from 'vitest';
import {
	fragmentar,
	fusionarVentanas,
	palabrasDeVentana,
	secuenciaComunMasLarga,
	type VentanaTranscrita
} from './fusion';

const textoDe = (palabras: { texto: string }[]) => palabras.map((p) => p.texto).join(' ');

describe('palabrasDeVentana', () => {
	it('interpola el tiempo de cada palabra dentro de su turno, en tiempo absoluto', () => {
		const palabras = palabrasDeVentana({
			inicioMs: 60_000,
			duracionMs: 30_000,
			// Palabras del mismo largo: el tiempo se reparte en partes iguales.
			turnos: [{ startMs: 1_000, endMs: 5_000, transcript: 'uno dos sol mar' }]
		});
		expect(palabras.map((p) => p.inicioMs)).toEqual([61_000, 62_000, 63_000, 64_000]);
		expect(palabras.at(-1)?.finMs).toBe(65_000);
	});

	it('ignora turnos vacíos y puntuación suelta', () => {
		const palabras = palabrasDeVentana({
			inicioMs: 0,
			duracionMs: 30_000,
			turnos: [
				{ startMs: 0, endMs: 0, transcript: '' },
				{ startMs: 0, endMs: 2_000, transcript: 'hola — mundo' }
			]
		});
		expect(palabras.map((p) => p.norma)).toEqual(['hola', 'mundo']);
	});
});

describe('fusionarVentanas', () => {
	it('quita las palabras repetidas en el solape', () => {
		const ventanas: VentanaTranscrita[] = [
			{
				inicioMs: 0,
				duracionMs: 30_000,
				turnos: [
					{ startMs: 20_000, endMs: 30_000, transcript: 'hermanos míos tened por sumo gozo' }
				]
			},
			{
				inicioMs: 25_000,
				duracionMs: 30_000,
				turnos: [
					{ startMs: 0, endMs: 10_000, transcript: 'por sumo gozo cuando os halléis en pruebas' }
				]
			}
		];
		expect(textoDe(fusionarVentanas(ventanas))).toBe(
			'hermanos míos tened por sumo gozo cuando os halléis en pruebas'
		);
	});

	it('recupera la palabra que la ventana anterior cortó en su borde', () => {
		// Caso medido el 2026-10-27: «la prueba de vuestra [fe] produce paciencia».
		const ventanas: VentanaTranscrita[] = [
			{
				inicioMs: 0,
				duracionMs: 30_000,
				turnos: [
					{ startMs: 22_000, endMs: 30_000, transcript: 'sabiendo que la prueba de vuestra' }
				]
			},
			{
				inicioMs: 25_000,
				duracionMs: 30_000,
				turnos: [
					{ startMs: 0, endMs: 8_000, transcript: 'la prueba de vuestra fe produce paciencia' }
				]
			}
		];
		expect(textoDe(fusionarVentanas(ventanas))).toBe(
			'sabiendo que la prueba de vuestra fe produce paciencia'
		);
	});

	it('usa la versión de la ventana nueva cuando la anterior cortó mal una palabra', () => {
		const ventanas: VentanaTranscrita[] = [
			{
				inicioMs: 0,
				duracionMs: 30_000,
				turnos: [{ startMs: 24_000, endMs: 30_000, transcript: 'Santiago capítulo uno vers' }]
			},
			{
				inicioMs: 25_000,
				duracionMs: 30_000,
				turnos: [{ startMs: 0, endMs: 6_000, transcript: 'capítulo uno versículo dos dice' }]
			}
		];
		expect(textoDe(fusionarVentanas(ventanas))).toBe('Santiago capítulo uno versículo dos dice');
	});

	it('sin coincidencia fiable, corta por la mitad del solape sin duplicar', () => {
		const ventanas: VentanaTranscrita[] = [
			{
				inicioMs: 0,
				duracionMs: 30_000,
				turnos: [
					{ startMs: 20_000, endMs: 26_000, transcript: 'antes' },
					{ startMs: 28_000, endMs: 30_000, transcript: 'ruido' }
				]
			},
			{
				inicioMs: 25_000,
				duracionMs: 30_000,
				turnos: [
					{ startMs: 0, endMs: 1_000, transcript: 'otro' },
					{ startMs: 5_000, endMs: 8_000, transcript: 'después' }
				]
			}
		];
		// Mitad del solape: 27,5 s. Queda «antes» (20 s) y «después» (30 s).
		expect(textoDe(fusionarVentanas(ventanas))).toBe('antes después');
	});

	it('une ventanas sin solape tal cual y tolera ventanas en silencio', () => {
		const ventanas: VentanaTranscrita[] = [
			{ inicioMs: 0, duracionMs: 30_000, turnos: [{ startMs: 0, endMs: 1_000, transcript: 'a' }] },
			{ inicioMs: 25_000, duracionMs: 30_000, turnos: [] },
			{
				inicioMs: 60_000,
				duracionMs: 10_000,
				turnos: [{ startMs: 0, endMs: 1_000, transcript: 'b' }]
			}
		];
		expect(textoDe(fusionarVentanas(ventanas))).toBe('a b');
	});
});

describe('secuenciaComunMasLarga', () => {
	it('encuentra la subsecuencia contigua y su posición en ambas listas', () => {
		expect(secuenciaComunMasLarga(['x', 'a', 'b', 'c'], ['a', 'b', 'c', 'y'])).toEqual({
			inicioA: 1,
			inicioB: 0,
			largo: 3
		});
	});
});

describe('fragmentar', () => {
	const lecturaLarga = (segundos: number) => {
		// Una palabra por segundo, sin pausas ni puntos: el pasaje leído de 2 min 23 s.
		const turnos = [
			{
				startMs: 0,
				endMs: segundos * 1000,
				transcript: Array.from({ length: segundos }, (_, i) => `p${i}`).join(' ')
			}
		];
		return palabrasDeVentana({ inicioMs: 383_000, duracionMs: segundos * 1000, turnos });
	};

	it('parte una lectura de corrido en fragmentos de 20 s o menos', () => {
		const fragmentos = fragmentar(lecturaLarga(143));
		expect(fragmentos.length).toBeGreaterThanOrEqual(8);
		for (const f of fragmentos) expect(f.finMs - f.inicioMs).toBeLessThanOrEqual(20_000);
		expect(fragmentos[0].inicioMs).toBe(383_000);
	});

	it('no pierde ni repite palabras al fragmentar', () => {
		const palabras = lecturaLarga(143);
		const fragmentos = fragmentar(palabras);
		expect(fragmentos.map((f) => f.texto).join(' ')).toBe(textoDe(palabras));
	});

	it('prefiere cortar en el final de una frase', () => {
		const palabras = palabrasDeVentana({
			inicioMs: 0,
			duracionMs: 30_000,
			turnos: [
				{ startMs: 0, endMs: 10_000, transcript: 'primera frase que dura diez segundos.' },
				{ startMs: 10_000, endMs: 14_000, transcript: 'segunda frase' }
			]
		});
		expect(fragmentar(palabras).map((f) => f.texto)).toEqual([
			'primera frase que dura diez segundos.',
			'segunda frase'
		]);
	});
});
