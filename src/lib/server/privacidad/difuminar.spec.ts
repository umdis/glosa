import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { elegirOrador, filtroDifuminado, leerCajas, obtenerDifuminado } from './difuminar';

const caja = (i: number, x1: number, y1: number, x2: number, y2: number, w = 640, h = 426) =>
	`${i}<|box;x1=${x1};y1=${y1};x2=${x2};y2=${y2};w=${w};h=${h};c=0.9|><|mask;x=0;y=0;c=0.9;data=4,4,!!!!!|>`;

/** Cajas reales de SAM 3.1 sobre la escena sintética del reconocimiento (2026-11-04). */
const ESCENA =
	'<0f>' +
	[
		caja(0, 254, 169, 345, 272),
		caja(7, 415, 235, 636, 425), // primer plano, la más grande
		caja(10, 185, 227, 392, 424), // primer plano, centrada y grande
		caja(13, 265, 153, 335, 228),
		caja(17, 205, 144, 261, 240),
		caja(19, 282, 67, 369, 146), // el predicador, de pie en el púlpito
		caja(12, 0, 233, 180, 423)
	].join(',');

describe('leerCajas', () => {
	it('lee cajas, tamaño del cuadro y confianza, y salta las cajas imposibles', () => {
		const seg = leerCajas(ESCENA + ',' + caja(99, 50, 50, 40, 60));
		expect(seg.ancho).toBe(640);
		expect(seg.alto).toBe(426);
		expect(seg.cajas).toHaveLength(7);
		expect(seg.cajas[5]).toEqual({ x1: 282, y1: 67, x2: 369, y2: 146, c: 0.9 });
	});

	it('sin coincidencias, sin cajas', () => {
		expect(leerCajas('').cajas).toEqual([]);
	});
});

describe('elegirOrador', () => {
	it('elige al que está de pie al frente, no a la persona más grande del primer plano', () => {
		const seg = leerCajas(ESCENA);
		expect(seg.cajas[elegirOrador(seg)!]).toMatchObject({ x1: 282, y1: 67 });
	});

	it('un plano del predicador solo: él es el orador', () => {
		const seg = leerCajas('<0f>' + caja(0, 166, 39, 432, 359, 640, 360));
		expect(elegirOrador(seg)).toBe(0);
	});

	it('nadie en el tercio central: no hay orador y se difumina a todos', () => {
		const seg = leerCajas('<0f>' + caja(0, 0, 50, 100, 300) + ',' + caja(1, 520, 40, 630, 300));
		expect(elegirOrador(seg)).toBeNull();
	});
});

describe('filtroDifuminado', () => {
	it('un desenfoque, un recorte por persona con margen, dentro del cuadro y en pares', () => {
		const seg = leerCajas(ESCENA);
		const orador = elegirOrador(seg)!;
		const filtro = filtroDifuminado(
			seg,
			seg.cajas.filter((_, i) => i !== orador)
		)!;
		expect(filtro.match(/gblur/g)).toHaveLength(1);
		expect(filtro.match(/crop=/g)).toHaveLength(6);
		expect(filtro.match(/overlay=/g)).toHaveLength(6);
		expect(filtro.endsWith('[v]')).toBe(true);
		// La del primer plano derecho (415–636) con margen no se sale del cuadro de 640×426.
		const recortes = [...filtro.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].map((m) =>
			m.slice(1).map(Number)
		);
		for (const [w, h, x, y] of recortes) {
			expect((w % 2) + (h % 2)).toBe(0);
			expect(x + w).toBeLessThanOrEqual(640);
			expect(y + h).toBeLessThanOrEqual(426);
		}
		// El predicador (282,67) no se tapa.
		expect(recortes.some(([, , x, y]) => x <= 282 && y <= 67 && y > 50)).toBe(false);
	});

	it('sin nadie que tapar, sin filtro', () => {
		expect(filtroDifuminado(leerCajas(ESCENA), [])).toBeNull();
	});
});

describe('obtenerDifuminado', () => {
	it('lo guardado se sirve sin llamar a SAM, aunque se haya llegado al tope', async () => {
		const carpeta = await mkdtemp(join(tmpdir(), 'glosa-difuminado-'));
		const destino = join(carpeta, '60-320-p.jpg');
		await writeFile(destino, 'jpeg ya difuminado');
		let llamadas = 0;
		const deps = {
			meta: {
				segmentar: async () => {
					llamadas++;
					return '';
				}
			},
			ffmpeg: 'no-se-usa'
		};
		expect(await obtenerDifuminado(deps, 'original.jpg', destino, () => false)).toBe(destino);
		expect(llamadas).toBe(0);
	});

	it('sin caché y con el tope alcanzado, falla: nunca se sirve el original', async () => {
		const carpeta = await mkdtemp(join(tmpdir(), 'glosa-difuminado-'));
		const destino = join(carpeta, '60-320-p.jpg');
		const deps = {
			meta: { segmentar: async () => '' },
			ffmpeg: 'no-se-usa'
		};
		await expect(obtenerDifuminado(deps, 'original.jpg', destino, () => false)).rejects.toThrow(
			'Tope'
		);
		expect(existsSync(destino)).toBe(false);
	});

	it('si SAM falla, no queda ningún archivo que servir', async () => {
		const carpeta = await mkdtemp(join(tmpdir(), 'glosa-difuminado-'));
		const original = join(carpeta, 'original.jpg');
		await writeFile(original, 'jpeg');
		const destino = join(carpeta, '60-320-p.jpg');
		const deps = {
			meta: {
				segmentar: async () => {
					throw new Error('SAM 503');
				}
			},
			ffmpeg: 'no-se-usa'
		};
		await expect(obtenerDifuminado(deps, original, destino, () => true)).rejects.toThrow('SAM');
		expect(existsSync(destino)).toBe(false);
	});
});
