import { join } from 'node:path';
import {
	DAILY_SPEND_CAP_USD,
	DATA_DIR,
	FFMPEG_PATH,
	FFPROBE_PATH,
	MODEL_API_KEY
} from '$app/env/private';
import { gastoDelDia } from './db/gasto';
import { abrirBase, type Base } from './db/base';
import { registroGastoSqlite } from './db/gasto';
import {
	procesarVideo,
	recuperarInterrumpidos,
	type DependenciasIngesta
} from './ingesta/pipeline';
import type { RutasFfmpeg } from './medios/ffmpeg';
import { ClienteMeta } from './meta/cliente';

/** Servicios compartidos del proceso. Se crean una sola vez, al primer uso. */
interface Servicios {
	db: Base;
	meta: ClienteMeta;
	rutas: RutasFfmpeg;
	carpetaMedios: string;
	/** Encola el procesamiento de un video; se procesan de a uno para no saturar la API. */
	encolarProcesamiento(videoId: string): void;
	/** Si el gasto del día ya alcanzó el tope de la demo (design.md D10). */
	topeAlcanzado(): boolean;
}

let servicios: Servicios | undefined;

export function obtenerServicios(): Servicios {
	if (!servicios) {
		const db = abrirBase(join(DATA_DIR, 'glosa.db'));
		recuperarInterrumpidos(db);
		const meta = new ClienteMeta({ apiKey: MODEL_API_KEY, registroGasto: registroGastoSqlite(db) });
		const deps: DependenciasIngesta = {
			db,
			meta,
			rutas: { ffmpeg: FFMPEG_PATH, ffprobe: FFPROBE_PATH },
			carpetaMedios: join(DATA_DIR, 'medios')
		};

		// TODO(juego-largo): cola en memoria; un reinicio la vacía y recuperarInterrumpidos
		// deja esos videos para reintentar a mano. El camino correcto es una cola persistente.
		// Registrada en: openspec/changes/nucleo-glosa/design.md (Registro de decisión).
		let cola = Promise.resolve();
		const encolarProcesamiento = (videoId: string) => {
			cola = cola
				.then(() => procesarVideo(deps, videoId))
				.catch((error) => console.error(`Falló el procesamiento de ${videoId}`, error));
		};

		const topeAlcanzado = () => gastoDelDia(db) >= DAILY_SPEND_CAP_USD;

		servicios = { ...deps, meta, encolarProcesamiento, topeAlcanzado };
	}
	return servicios;
}
