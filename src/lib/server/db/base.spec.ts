import { describe, expect, it } from 'vitest';
import { abrirBase, migrar } from './base';
import { migraciones } from './esquema';
import { gastoDelDia, registroGastoSqlite } from './gasto';

function baseConVideo() {
	const db = abrirBase(':memory:');
	db.prepare(
		`INSERT INTO videos (id, titulo, archivo_original) VALUES ('v1', 'Prédica', 'x.mp4')`
	).run();
	return db;
}

function insertarFragmento(
	db: ReturnType<typeof abrirBase>,
	orden: number,
	texto: string,
	raiz: string
) {
	return db
		.prepare(
			`INSERT INTO fragmentos (video_id, orden, inicio_ms, fin_ms, texto, texto_raiz)
			 VALUES ('v1', ?, ?, ?, ?, ?)`
		)
		.run(orden, orden * 20_000, orden * 20_000 + 15_000, texto, raiz).lastInsertRowid;
}

describe('abrirBase', () => {
	it('aplica todas las migraciones y es idempotente', () => {
		const db = abrirBase(':memory:');
		expect(db.pragma('user_version', { simple: true })).toBe(migraciones.length);
		migrar(db);
		expect(db.pragma('user_version', { simple: true })).toBe(migraciones.length);
	});

	it('mantiene los índices de búsqueda al insertar, editar y borrar fragmentos', () => {
		const db = baseConVideo();
		const id = insertarFragmento(db, 0, 'La tentación nos prueba', 'la tentacion nos prueb');
		const porRaiz = (consulta: string) =>
			db
				.prepare(`SELECT rowid FROM fragmentos_raices WHERE fragmentos_raices MATCH ?`)
				.all(consulta);
		const porTrigrama = (consulta: string) =>
			db
				.prepare(`SELECT rowid FROM fragmentos_trigramas WHERE fragmentos_trigramas MATCH ?`)
				.all(consulta);

		expect(porRaiz('tentacion')).toEqual([{ rowid: id }]);
		// El índice de trigramas ignora tildes y mayúsculas sobre el texto original.
		expect(porTrigrama('"TENTACION"')).toEqual([{ rowid: id }]);

		db.prepare(
			`UPDATE fragmentos SET texto = 'Hermanos míos', texto_raiz = 'herman mi' WHERE id = ?`
		).run(id);
		expect(porRaiz('tentacion')).toEqual([]);
		expect(porTrigrama('"hermanos"')).toEqual([{ rowid: id }]);

		db.prepare(`DELETE FROM fragmentos WHERE id = ?`).run(id);
		expect(porRaiz('herman')).toEqual([]);
		expect(porTrigrama('"hermanos"')).toEqual([]);
	});

	it('rechaza fragmentos con el fin antes del inicio', () => {
		const db = baseConVideo();
		expect(() =>
			db
				.prepare(
					`INSERT INTO fragmentos (video_id, orden, inicio_ms, fin_ms, texto, texto_raiz)
					 VALUES ('v1', 0, 5000, 1000, 'x', 'x')`
				)
				.run()
		).toThrow();
	});

	it('borra en cascada lo que cuelga de un video', () => {
		const db = baseConVideo();
		insertarFragmento(db, 0, 'Santiago capítulo uno', 'santiag capitul uno');
		db.prepare(`DELETE FROM videos WHERE id = 'v1'`).run();
		expect(db.prepare(`SELECT COUNT(*) AS n FROM fragmentos`).get()).toEqual({ n: 0 });
	});
});

describe('gasto', () => {
	it('suma el gasto registrado del día', () => {
		const db = abrirBase(':memory:');
		const registro = registroGastoSqlite(db);
		const uso = {
			modelo: 'muse-spark-1.3',
			operacion: 'prueba',
			tokensEntrada: 1000,
			tokensCache: 0,
			tokensSalida: 10,
			segundosAudio: 0
		};
		registro.registrar({ ...uso, costoUsd: 0.25 });
		registro.registrar({ ...uso, costoUsd: 0.5 });
		expect(gastoDelDia(db)).toBeCloseTo(0.75);
	});
});
