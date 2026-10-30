import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import { avanceSubtitulos } from './subtitulos';

describe('avanceSubtitulos', () => {
	it('cuenta solo las líneas visibles y las que ya tienen traducción', () => {
		const db = abrirBase(':memory:');
		registrarVideo(db, 'v1', 'Devocional', []);
		guardarFragmentos(db, 'v1', [
			{ inicioMs: 0, finMs: 10_000, texto: 'hermanos míos' },
			{ inicioMs: 10_000, finMs: 20_000, texto: 'tened por sumo gozo' },
			{ inicioMs: 20_000, finMs: 30_000, texto: 'oramos por la salud del hermano Pedro' }
		]);
		db.prepare(`UPDATE fragmentos SET visibilidad = 'pendiente' WHERE orden = 2`).run();
		db.prepare(`INSERT INTO traducciones (original, idioma, texto) VALUES (?, 'en', ?)`).run(
			'hermanos míos',
			'my brothers'
		);
		// Una traducción de una línea oculta no cuenta ni la hace visible.
		db.prepare(`INSERT INTO traducciones (original, idioma, texto) VALUES (?, 'en', ?)`).run(
			'oramos por la salud del hermano Pedro',
			'we pray for brother Pedro'
		);

		expect(avanceSubtitulos(db, 'v1', 'en')).toEqual({ traducidas: 1, total: 2 });
		expect(avanceSubtitulos(db, 'v1', 'pt')).toEqual({ traducidas: 0, total: 2 });
	});
});
