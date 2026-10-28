import { describe, expect, it } from 'vitest';
import { abrirBase } from './db/base';
import { guardarFragmentos, registrarVideo } from './ingesta/pipeline';
import { subtitulosVtt, videoPublico } from './videos';

describe('subtitulosVtt', () => {
	it('genera WebVTT válido con marcas de horas, minutos, segundos y milésimas', () => {
		expect(
			subtitulosVtt([
				{ id: 1, inicioMs: 383_500, finMs: 399_250, texto: 'hermanos míos' },
				{ id: 2, inicioMs: 3_723_004, finMs: 3_725_000, texto: 'a --> b' }
			])
		).toBe(
			'WEBVTT\n\n' +
				'1\n00:06:23.500 --> 00:06:39.250\nhermanos míos\n\n' +
				'2\n01:02:03.004 --> 01:02:05.000\na → b\n'
		);
	});
});

describe('videoPublico', () => {
	it('solo cuenta los videos reproducibles con transcripción visible', () => {
		const db = abrirBase(':memory:');
		registrarVideo(db, 'v1', 'Prédica', []);
		guardarFragmentos(db, 'v1', [{ inicioMs: 0, finMs: 5000, texto: 'Hermanos' }]);
		expect(videoPublico(db, 'v1')).toBeUndefined();

		db.prepare(`UPDATE videos SET archivo_reproduccion = 'reproducir.mp4' WHERE id = 'v1'`).run();
		expect(videoPublico(db, 'v1')?.titulo).toBe('Prédica');

		db.prepare(`UPDATE fragmentos SET visibilidad = 'pendiente' WHERE video_id = 'v1'`).run();
		expect(videoPublico(db, 'v1')).toBeUndefined();
	});
});
