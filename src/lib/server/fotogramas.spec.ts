import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { argumentosFotograma } from './medios/ffmpeg';
import {
	anchoValido,
	obtenerFotograma,
	segundoPoster,
	segundoValido,
	type PedidoFotograma
} from './fotogramas';

describe('segundoValido', () => {
	it('ajusta el segundo a la duración del video', () => {
		expect(segundoValido('383', 43 * 60_000)).toBe(383);
		expect(segundoValido('99999', 43 * 60_000)).toBe(43 * 60 - 1);
		expect(segundoValido('-5', 43 * 60_000)).toBe(0);
		expect(segundoValido('12.9', null)).toBe(12);
		expect(segundoValido('abc', 1000)).toBeNull();
	});
});

describe('anchoValido y segundoPoster', () => {
	it('solo admite 320 y 640', () => {
		expect(anchoValido('640')).toBe(640);
		expect(anchoValido('1920')).toBe(320);
		expect(anchoValido(null)).toBe(320);
	});

	it('el póster evita el arranque del video', () => {
		expect(segundoPoster(43 * 60_000)).toBe(60);
		expect(segundoPoster(5 * 60_000)).toBe(30);
		expect(segundoPoster(null)).toBe(0);
	});
});

describe('argumentosFotograma', () => {
	it('salta antes de abrir el video y saca un solo cuadro escalado', () => {
		const args = argumentosFotograma('in.mp4', 383, 320, 'out.jpg');
		expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
		expect(args).toContain('scale=320:-2');
		expect(args.slice(args.indexOf('-frames:v'), args.indexOf('-frames:v') + 2)).toEqual([
			'-frames:v',
			'1'
		]);
		expect(args.at(-1)).toBe('out.jpg');
	});
});

describe('obtenerFotograma', () => {
	function preparar() {
		const carpetaVideo = mkdtempSync(join(tmpdir(), 'glosa-fotograma-'));
		let llamadas = 0;
		const pedido: PedidoFotograma = {
			carpetaVideo,
			archivoVideo: join(carpetaVideo, 'video.mp4'),
			segundo: 383,
			ancho: 320,
			extraer: async (_entrada, segundo, ancho, salida) => {
				llamadas++;
				await new Promise((r) => setTimeout(r, 20));
				await writeFile(salida, `jpeg ${segundo} ${ancho}`);
			}
		};
		return { pedido, carpetaVideo, llamadas: () => llamadas };
	}

	it('genera una vez y después sirve desde el disco', async () => {
		const { pedido, llamadas } = preparar();
		const primera = await obtenerFotograma(pedido);
		const segunda = await obtenerFotograma(pedido);
		expect(primera).toBe(segunda);
		expect(readFileSync(primera, 'utf8')).toBe('jpeg 383 320');
		expect(llamadas()).toBe(1);
	});

	it('las peticiones simultáneas comparten un solo ffmpeg', async () => {
		const { pedido, llamadas } = preparar();
		await Promise.all([
			obtenerFotograma(pedido),
			obtenerFotograma(pedido),
			obtenerFotograma(pedido)
		]);
		expect(llamadas()).toBe(1);
	});

	it('si ffmpeg falla no deja archivos a medias', async () => {
		const { pedido, carpetaVideo } = preparar();
		pedido.extraer = async (_e, _s, _a, salida) => {
			await writeFile(salida, 'a medias');
			throw new Error('ffmpeg falló');
		};
		await expect(obtenerFotograma(pedido)).rejects.toThrow('ffmpeg falló');
		expect(readdirSync(join(carpetaVideo, 'fotogramas'))).toEqual([]);
	});
});
