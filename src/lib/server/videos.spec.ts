import { describe, expect, it } from 'vitest';
import { subtitulosVtt } from './videos';

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
