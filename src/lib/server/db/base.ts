import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migraciones } from './esquema';

export type Base = Database.Database;

/** Abre (o crea) la base y aplica las migraciones pendientes. `':memory:'` para pruebas. */
export function abrirBase(ruta: string): Base {
	if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
	const db = new Database(ruta);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	migrar(db);
	return db;
}

export function migrar(db: Base): void {
	const actual = db.pragma('user_version', { simple: true }) as number;
	for (let version = actual; version < migraciones.length; version++) {
		db.transaction(() => {
			db.exec(migraciones[version]);
			db.pragma(`user_version = ${version + 1}`);
		})();
	}
}
