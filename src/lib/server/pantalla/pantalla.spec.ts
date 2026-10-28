import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import { registrarVideo } from '../ingesta/pipeline';
import { guardarEnPantalla, leerEnPantalla, leerListaTramos, textoDeSalida } from './pantalla';

describe('tramos', () => {
	it('toma el inicio real de cada tramo de la lista de ffmpeg', () => {
		expect(
			leerListaTramos('tramo-000.mp4,0.000000,600.100000\ntramo-001.mp4,600.100000,1203.4\n', '/t')
		).toEqual([
			{ archivo: expect.stringContaining('tramo-000.mp4'), inicioMs: 0 },
			{ archivo: expect.stringContaining('tramo-001.mp4'), inicioMs: 600_100 }
		]);
	});
});

describe('leerEnPantalla', () => {
	it('pasa los minutos del tramo a tiempo absoluto y quita repeticiones seguidas', () => {
		const contenido = JSON.stringify({
			en_pantalla: [
				{ t: '03:13', texto: 'Pecados en la crianza de valores 1. Conocimiento' },
				{ t: '03:40', texto: 'Pecados en la crianza de valores 1. Conocimiento' },
				{ t: '04:50', texto: 'Pecados en la crianza de valores 1. Conocimiento 2. Vivencia' },
				{ t: 'mal', texto: 'sin momento' }
			]
		});
		expect(leerEnPantalla(contenido, 1_500_000)).toEqual([
			{ momentoMs: 1_500_000 + 193_000, texto: 'Pecados en la crianza de valores 1. Conocimiento' },
			{
				momentoMs: 1_500_000 + 290_000,
				texto: 'Pecados en la crianza de valores 1. Conocimiento 2. Vivencia'
			}
		]);
	});

	it('falla si la respuesta no es JSON (el paso queda para reintentar)', () => {
		expect(() => leerEnPantalla('no puedo ver el video', 0)).toThrow(/JSON/);
	});

	it('lee el texto de la Responses API en sus dos formas', () => {
		expect(textoDeSalida({ output_text: '{"a":1}' })).toBe('{"a":1}');
		expect(
			textoDeSalida({
				output: [
					{ type: 'reasoning' },
					{ type: 'message', content: [{ type: 'output_text', text: '{"b":2}' }] }
				]
			})
		).toBe('{"b":2}');
	});
});

describe('guardarEnPantalla', () => {
	it('guarda los textos y extrae una sola vez los pasajes escritos', () => {
		const db = abrirBase(':memory:');
		registrarVideo(db, 'v1', 'Prédica', []);
		const refs = guardarEnPantalla(db, 'v1', [
			{ momentoMs: 1_924_000, texto: '¿QUÉ ES CRIAR? Deuteronomio 6:6-9; 11:18-20' },
			{ momentoMs: 1_960_000, texto: '¿QUÉ ES CRIAR? Deuteronomio 6:6-9; 11:18-20 TENER VALORES' }
		]);
		expect(refs.map((r) => `${r.libro} ${r.capitulo}:${r.versiculoInicio}@${r.momentoMs}`)).toEqual(
			['Deuteronomio 6:6@1924000', 'Deuteronomio 11:18@1924000']
		);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM en_pantalla`).get()).toEqual({ n: 2 });
	});
});
