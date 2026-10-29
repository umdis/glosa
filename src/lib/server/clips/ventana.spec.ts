import { describe, expect, it } from 'vitest';
import { subtitulosClip, tarjetas, textoAss, tiempoAss } from './subtitulos';
import { calcularVentana, type FragmentoDeVideo } from './ventana';

/** Fragmentos de 10 s seguidos; los índices en `ocultos` no son visibles. */
function video(n: number, ocultos: number[] = [], duracionMs = 10_000): FragmentoDeVideo[] {
	return Array.from({ length: n }, (_, i) => ({
		id: 100 + i,
		orden: i,
		inicioMs: i * duracionMs,
		finMs: (i + 1) * duracionMs,
		texto: `fragmento ${i}`,
		visible: !ocultos.includes(i)
	}));
}

describe('calcularVentana', () => {
	it('crece hacia adelante hasta unos 30 s', () => {
		const v = calcularVentana(video(10), 103)!;
		expect(v.fragmentos.map((f) => f.orden)).toEqual([3, 4, 5]);
		expect([v.inicioMs, v.finMs]).toEqual([30_000, 60_000]);
		expect(v.citado.id).toBe(103);
	});

	it('al final del video crece hacia atrás', () => {
		const v = calcularVentana(video(5), 104)!;
		expect(v.fragmentos.map((f) => f.orden)).toEqual([2, 3, 4]);
	});

	it('se detiene ante un fragmento oculto y no lo incluye', () => {
		const v = calcularVentana(video(10, [5]), 103)!;
		expect(v.fragmentos.map((f) => f.orden)).toEqual([2, 3, 4]);
		expect(v.fragmentos.every((f) => f.visible)).toBe(true);
	});

	it('rechaza el clip si entre ocultos no llega a 15 s', () => {
		expect(calcularVentana(video(10, [2, 4]), 103)).toBeNull();
	});

	it('rechaza un fragmento citado que no es visible o no existe', () => {
		expect(calcularVentana(video(10, [3]), 103)).toBeNull();
		expect(calcularVentana(video(10), 999)).toBeNull();
	});

	it('nunca pasa de 60 s aunque los fragmentos sean largos', () => {
		const v = calcularVentana(video(10, [], 25_000), 103)!;
		expect(v.finMs - v.inicioMs).toBeLessThanOrEqual(60_000);
		expect(v.finMs - v.inicioMs).toBeGreaterThanOrEqual(15_000);
	});
});

describe('subtítulos ASS', () => {
	it('neutraliza las órdenes de ASS en el texto', () => {
		expect(textoAss('hola {\\b1}mundo\\N y\nmás')).toBe('hola (/b1)mundo/N y más');
	});

	it('formatea el tiempo', () => {
		expect(tiempoAss(0)).toBe('0:00:00.00');
		expect(tiempoAss(61_234)).toBe('0:01:01.23');
	});

	it('parte el texto en tarjetas de dos líneas sin cortar palabras', () => {
		const t = tarjetas(
			'el perdón empieza en la casa en la mesa de todos los días y sigue en la iglesia con los hermanos'
		);
		expect(t.length).toBeGreaterThan(1);
		for (const tarjeta of t) {
			const lineas = tarjeta.split('\\N');
			expect(lineas.length).toBeLessThanOrEqual(2);
			for (const l of lineas) expect(l.length).toBeLessThanOrEqual(30);
		}
		expect(t.join(' ').replace(/\\N/g, ' ')).toContain('perdón empieza en la casa');
	});

	it('los tiempos empiezan en 0 y no pasan de la duración del clip', () => {
		const v = calcularVentana(video(10), 103)!;
		const ass = subtitulosClip(v, { titulo: 'Familia', pie: 'glosa.umdis.site · ¶ 0:30' });
		const tiempos = [...ass.matchAll(/Dialogue: 0,([^,]+),([^,]+),Sub/g)];
		expect(tiempos[0][1]).toBe('0:00:00.00');
		expect(tiempos.at(-1)![2]).toBe('0:00:30.00');
		expect(ass).toContain('Style: Titulo,Alegreya Sans');
		expect(ass).toContain(',Titulo,,0,0,0,,Familia');
	});
});
