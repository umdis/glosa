import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import { guardarPasajesDichos, guardarPasajesEnPantalla, indicePublico } from './indice';
import { detectarDichas } from './referencias';

function preparar() {
	const db = abrirBase(':memory:');
	registrarVideo(db, 'v1', 'Devocional', []);
	guardarFragmentos(db, 'v1', [
		{ inicioMs: 356_000, finMs: 367_000, texto: 'Santiago capítulo uno versículo dos' },
		{ inicioMs: 1_000_000, finMs: 1_015_000, texto: 'Filipenses cuatro ocho, todo lo verdadero' },
		{ inicioMs: 2_000_000, finMs: 2_015_000, texto: 'por la hermana enferma, Salmo veintitrés' }
	]);
	const fragmentos = db
		.prepare(`SELECT id, inicio_ms AS inicioMs, texto FROM fragmentos ORDER BY orden`)
		.all() as Array<{ id: number; inicioMs: number; texto: string }>;
	return { db, fragmentos };
}

describe('índice de pasajes', () => {
	it('agrupa por libro en el orden del canon, con el momento de cada cita', () => {
		const { db, fragmentos } = preparar();
		guardarPasajesDichos(db, 'v1', detectarDichas(fragmentos));
		const indice = indicePublico(db);
		expect(indice.map((l) => l.libro)).toEqual(['Salmos', 'Filipenses', 'Santiago']);
		expect(indice[2].pasajes[0]).toMatchObject({
			capitulo: 1,
			versiculoInicio: 2,
			momentos: [{ videoId: 'v1', momentoMs: 356_000, origen: 'dicho' }]
		});
	});

	it('no muestra pasajes dichos en fragmentos pendientes u ocultos', () => {
		const { db, fragmentos } = preparar();
		guardarPasajesDichos(db, 'v1', detectarDichas(fragmentos));
		db.prepare(`UPDATE fragmentos SET visibilidad = 'pendiente' WHERE id = ?`).run(
			fragmentos[2].id
		);
		expect(indicePublico(db).map((l) => l.libro)).toEqual(['Filipenses', 'Santiago']);
	});

	it('reintentar no duplica y los de pantalla se guardan aparte', () => {
		const { db, fragmentos } = preparar();
		const refs = detectarDichas(fragmentos);
		guardarPasajesDichos(db, 'v1', refs);
		guardarPasajesDichos(db, 'v1', refs);
		guardarPasajesEnPantalla(db, 'v1', [
			{
				libro: 'Deuteronomio',
				capitulo: 6,
				versiculoInicio: 6,
				versiculoFin: 9,
				momentoMs: 424_000
			}
		]);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM pasajes`).get()).toEqual({ n: 4 });
		expect(indicePublico(db)[0]).toMatchObject({
			libro: 'Deuteronomio',
			pasajes: [{ momentos: [{ origen: 'en_pantalla', fragmentoId: fragmentos[0].id }] }]
		});
	});
});
