import { join } from 'node:path';
import {
	DAILY_SPEND_CAP_USD,
	DATA_DIR,
	FFMPEG_PATH,
	FFPROBE_PATH,
	MODEL_API_KEY,
	SHOW_FRAMES
} from '$app/env/private';
import { folio } from '../formato';
import { crearCola, generarClip, type ClipPedido } from './clips/generar';
import { gastoDelDia } from './db/gasto';
import { abrirBase, type Base } from './db/base';
import { registroGastoSqlite } from './db/gasto';
import {
	procesarVideo,
	recuperarInterrumpidos,
	type DependenciasIngesta
} from './ingesta/pipeline';
import type { RutasFfmpeg } from './medios/ffmpeg';
import { generarLamina, type PedidoLamina } from './laminas/lamina';
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
	/**
	 * Genera (o devuelve de la caché) el clip vertical de una cita. De uno en uno y con un máximo
	 * de tres esperando: ffmpeg comparte el servidor con otras apps (glosa-competitiva D5).
	 */
	clip(pedido: ClipPedido): Promise<string>;
	/** Genera (o devuelve de la caché) la lámina de una cita, con la misma cola de uno en uno. */
	lamina(pedido: PedidoLamina): Promise<string>;
	/** Carpeta de las láminas ya hechas. */
	carpetaLaminas: string;
}

let servicios: Servicios | undefined;

/** Fuentes TTF de los subtítulos de los clips, junto a la app (en la imagen, /app/fuentes). */
const CARPETA_FUENTES = join(process.cwd(), 'fuentes');

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

		const colaClips = crearCola(3);
		const clip = (pedido: ClipPedido) =>
			colaClips.encolar(pedido.archivo, () =>
				generarClip(
					{
						ffmpeg: FFMPEG_PATH,
						carpetaMedios: deps.carpetaMedios,
						fuentes: CARPETA_FUENTES,
						conImagen: SHOW_FRAMES,
						pie: (p) => `glosa.umdis.site · ¶ ${folio(p.ventana.citado.inicioMs)}`
					},
					pedido
				)
			);

		const carpetaLaminas = join(DATA_DIR, 'laminas');
		const colaLaminas = crearCola(3);
		const lamina = (pedido: PedidoLamina) =>
			colaLaminas.encolar(pedido.clave, () =>
				generarLamina(
					{ meta, ffmpeg: FFMPEG_PATH, carpeta: carpetaLaminas, fuentes: CARPETA_FUENTES },
					pedido
				)
			);

		servicios = {
			...deps,
			meta,
			encolarProcesamiento,
			topeAlcanzado,
			clip,
			lamina,
			carpetaLaminas
		};
	}
	return servicios;
}
