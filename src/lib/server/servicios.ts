import { join } from 'node:path';
import { DATA_DIR, MODEL_API_KEY } from '$app/env/private';
import { abrirBase, type Base } from './db/base';
import { registroGastoSqlite } from './db/gasto';
import { ClienteMeta } from './meta/cliente';

/** Servicios compartidos del proceso. Se crean una sola vez, al primer uso. */
interface Servicios {
	db: Base;
	meta: ClienteMeta;
}

let servicios: Servicios | undefined;

export function obtenerServicios(): Servicios {
	if (!servicios) {
		const db = abrirBase(join(DATA_DIR, 'glosa.db'));
		servicios = {
			db,
			meta: new ClienteMeta({ apiKey: MODEL_API_KEY, registroGasto: registroGastoSqlite(db) })
		};
	}
	return servicios;
}
