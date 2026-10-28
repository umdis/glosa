import Database from 'better-sqlite3';
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
	raiz: string,
	norma: string
) {
	return db
		.prepare(
			`INSERT INTO fragmentos (video_id, orden, inicio_ms, fin_ms, texto, texto_raiz, texto_norma)
			 VALUES ('v1', ?, ?, ?, ?, ?, ?)`
		)
		.run(orden, orden * 20_000, orden * 20_000 + 15_000, texto, raiz, norma).lastInsertRowid;
}

const consultas = (db: ReturnType<typeof abrirBase>) => ({
	porRaiz: (consulta: string) =>
		db.prepare(`SELECT rowid FROM fragmentos_raices WHERE fragmentos_raices MATCH ?`).all(consulta),
	porTrigrama: (consulta: string) =>
		db
			.prepare(`SELECT rowid FROM fragmentos_trigramas WHERE fragmentos_trigramas MATCH ?`)
			.all(consulta)
});

describe('abrirBase', () => {
	it('aplica todas las migraciones y es idempotente', () => {
		const db = abrirBase(':memory:');
		expect(db.pragma('user_version', { simple: true })).toBe(migraciones.length);
		migrar(db);
		expect(db.pragma('user_version', { simple: true })).toBe(migraciones.length);
	});

	it('mantiene los índices de búsqueda al insertar, editar y borrar fragmentos', () => {
		const db = baseConVideo();
		const { porRaiz, porTrigrama } = consultas(db);
		const id = insertarFragmento(
			db,
			0,
			'La tentación nos prueba',
			'la tentacion nos prueb',
			'la tentacion nos prueba'
		);

		expect(porRaiz('tentacion')).toEqual([{ rowid: id }]);
		expect(porTrigrama('"tentac"')).toEqual([{ rowid: id }]);

		db.prepare(
			`UPDATE fragmentos SET texto = 'Hermanos míos', texto_raiz = 'herman mi',
				texto_norma = 'hermanos mios' WHERE id = ?`
		).run(id);
		expect(porRaiz('tentacion')).toEqual([]);
		expect(porTrigrama('"hermanos"')).toEqual([{ rowid: id }]);

		db.prepare(`DELETE FROM fragmentos WHERE id = ?`).run(id);
		expect(porRaiz('herman')).toEqual([]);
		expect(porTrigrama('"hermanos"')).toEqual([]);
	});

	it('el índice de trigramas distingue la ñ: «año» no encuentra «hermano»', () => {
		const db = baseConVideo();
		const { porTrigrama } = consultas(db);
		insertarFragmento(db, 0, 'un hermano', 'un herman', 'un hermano');
		const anos = insertarFragmento(db, 1, 'tantos años', 'tant años', 'tantos años');
		expect(porTrigrama('"año"')).toEqual([{ rowid: anos }]);
	});

	it('la migración 2 recalcula raíces y texto normalizado de lo guardado antes', () => {
		const db = new Database(':memory:');
		db.exec(migraciones[0] as string);
		db.pragma('user_version = 1');
		db.prepare(`INSERT INTO videos (id, titulo, archivo_original) VALUES ('v1', 't', 'x')`).run();
		db.prepare(
			`INSERT INTO fragmentos (video_id, orden, inicio_ms, fin_ms, texto, texto_raiz)
			 VALUES ('v1', 0, 0, 1000, 'Las tentaciones de tantos años', 'sin raices')`
		).run();

		migrar(db);
		expect(db.prepare(`SELECT texto_raiz, texto_norma FROM fragmentos`).get()).toEqual({
			texto_raiz: 'las tentacion de tant años',
			texto_norma: 'las tentaciones de tantos años'
		});
		const { porRaiz, porTrigrama } = consultas(db);
		expect(porRaiz('tentacion')).toHaveLength(1);
		expect(porTrigrama('"año"')).toHaveLength(1);
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
		insertarFragmento(
			db,
			0,
			'Santiago capítulo uno',
			'santiag capitul uno',
			'santiago capitulo uno'
		);
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
