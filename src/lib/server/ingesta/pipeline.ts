import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { guardarPasajesDichos } from '../biblia/indice';
import { NOMBRES_LIBROS } from '../biblia/libros';
import { detectarDichas } from '../biblia/referencias';
import type { Base } from '../db/base';
import { extraerAudio, normalizarVideo, probar, type RutasFfmpeg } from '../medios/ffmpeg';
import { cortarEnVentanas } from '../medios/wav';
import type { ClienteMeta } from '../meta/cliente';
import { guardarFicha, proponerFicha } from '../revision/resumen';
import {
	aplicarClasificacion,
	clasificarSensibles,
	fragmentosPorClasificar,
	type Marcado
} from '../revision/sensibles';
import { normalizar } from '../texto/normalizar';
import { textoARaices } from '../texto/raices';
import { fragmentar, fusionarVentanas } from './fusion';
import { transcribirVentanas } from './transcripcion';

export interface DependenciasIngesta {
	db: Base;
	meta: Pick<ClienteMeta, 'transcribir' | 'chat'>;
	rutas: RutasFfmpeg;
	/** Carpeta raíz de los medios; cada video vive en `<carpetaMedios>/<id>/`. */
	carpetaMedios: string;
}

interface ContextoPaso extends DependenciasIngesta {
	videoId: string;
	carpeta: string;
}

export interface Paso {
	nombre: string;
	/** Pasos que deben estar hechos antes de ejecutar este. */
	requiere: string[];
	ejecutar(ctx: ContextoPaso): Promise<void>;
}

export const ARCHIVO_ORIGINAL = 'original';
export const ARCHIVO_REPRODUCCION = 'reproduccion.mp4';
const ARCHIVO_AUDIO = 'audio.wav';

const pasoNormalizar: Paso = {
	nombre: 'normalizar',
	requiere: [],
	async ejecutar({ db, rutas, videoId, carpeta }) {
		const original = join(carpeta, ARCHIVO_ORIGINAL);
		const info = await probar(rutas, original);
		await normalizarVideo(rutas, original, join(carpeta, ARCHIVO_REPRODUCCION));
		await extraerAudio(rutas, original, join(carpeta, ARCHIVO_AUDIO));
		db.prepare(
			`UPDATE videos SET archivo_reproduccion = ?, duracion_ms = ?, actualizado_en = datetime('now')
			 WHERE id = ?`
		).run(ARCHIVO_REPRODUCCION, info.duracionMs, videoId);
	}
};

const pasoTranscribir: Paso = {
	nombre: 'transcribir',
	requiere: ['normalizar'],
	async ejecutar({ db, meta, videoId, carpeta }) {
		const audio = new Uint8Array(await readFile(join(carpeta, ARCHIVO_AUDIO)));
		const ventanas = cortarEnVentanas(audio, 30_000, 5_000);
		const transcritas = await transcribirVentanas(meta, ventanas, {
			concurrencia: 8,
			idiomas: ['es'],
			palabrasClave: [...NOMBRES_LIBROS]
		});
		const fragmentos = fragmentar(fusionarVentanas(transcritas));
		// Nacen ocultos: solo se publican después de la clasificación de segmentos sensibles.
		guardarFragmentos(db, videoId, fragmentos, 'pendiente');
	}
};

/** Tope de fragmentos por llamada de clasificación (unas 3 h de habla caben de sobra). */
const LOTE_CLASIFICACION = 300;

const pasoSensibles: Paso = {
	nombre: 'sensibles',
	requiere: ['transcribir'],
	async ejecutar({ db, meta, videoId }) {
		const fragmentos = fragmentosPorClasificar(db, videoId);
		const marcados: Marcado[] = [];
		for (let i = 0; i < fragmentos.length; i += LOTE_CLASIFICACION) {
			marcados.push(
				...(await clasificarSensibles(meta, fragmentos.slice(i, i + LOTE_CLASIFICACION)))
			);
		}
		aplicarClasificacion(db, videoId, fragmentos, marcados);
	}
};

const pasoFicha: Paso = {
	nombre: 'ficha',
	requiere: ['sensibles'],
	async ejecutar({ db, meta, videoId }) {
		const { titulo } = db.prepare(`SELECT titulo FROM videos WHERE id = ?`).get(videoId) as {
			titulo: string;
		};
		const texto = (
			db
				.prepare(
					`SELECT texto FROM fragmentos WHERE video_id = ? AND visibilidad = 'visible' ORDER BY orden`
				)
				.all(videoId) as Array<{ texto: string }>
		)
			.map((f) => f.texto)
			.join(' ');
		if (!texto) return;
		guardarFicha(db, videoId, await proponerFicha(meta, titulo, texto));
	}
};

/**
 * Pasajes bíblicos dichos: detector por reglas validado contra el canon. No llama a la IA.
 * Se guardan todos; el índice público solo muestra los de fragmentos visibles.
 */
const pasoPasajes: Paso = {
	nombre: 'pasajes',
	requiere: ['transcribir'],
	async ejecutar({ db, videoId }) {
		const fragmentos = db
			.prepare(
				`SELECT id, inicio_ms AS inicioMs, texto FROM fragmentos WHERE video_id = ? ORDER BY orden`
			)
			.all(videoId) as Array<{ id: number; inicioMs: number; texto: string }>;
		guardarPasajesDichos(db, videoId, detectarDichas(fragmentos));
	}
};

/** Pasos en orden. La sección 8 (lo que aparece en pantalla) se agrega aquí. */
export const PASOS: Paso[] = [
	pasoNormalizar,
	pasoTranscribir,
	pasoSensibles,
	pasoPasajes,
	pasoFicha
];

/** Reemplaza los fragmentos del video; así reintentar la transcripción no duplica nada. */
export function guardarFragmentos(
	db: Base,
	videoId: string,
	fragmentos: Array<{ inicioMs: number; finMs: number; texto: string }>,
	visibilidad: 'visible' | 'pendiente' = 'visible'
): void {
	const borrar = db.prepare(`DELETE FROM fragmentos WHERE video_id = ?`);
	const insertar = db.prepare(
		`INSERT INTO fragmentos
			(video_id, orden, inicio_ms, fin_ms, texto, texto_raiz, texto_norma, visibilidad)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	);
	db.transaction(() => {
		borrar.run(videoId);
		fragmentos.forEach((f, orden) => {
			insertar.run(
				videoId,
				orden,
				f.inicioMs,
				f.finMs,
				f.texto,
				textoARaices(f.texto),
				normalizar(f.texto),
				visibilidad
			);
		});
	})();
}

/** Registra un video recién subido con todos sus pasos pendientes. */
export function registrarVideo(db: Base, id: string, titulo: string, pasos = PASOS): void {
	db.transaction(() => {
		db.prepare(`INSERT INTO videos (id, titulo, archivo_original) VALUES (?, ?, ?)`).run(
			id,
			titulo,
			ARCHIVO_ORIGINAL
		);
		const insertar = db.prepare(
			`INSERT INTO video_pasos (video_id, paso, estado) VALUES (?, ?, 'pendiente')`
		);
		for (const paso of pasos) insertar.run(id, paso.nombre);
	})();
}

type EstadoPaso = 'pendiente' | 'en_curso' | 'hecho' | 'fallido';

function marcarPaso(db: Base, videoId: string, paso: string, estado: EstadoPaso, error?: string) {
	db.prepare(
		`INSERT INTO video_pasos (video_id, paso, estado, error, actualizado_en)
		 VALUES (?, ?, ?, ?, datetime('now'))
		 ON CONFLICT (video_id, paso) DO UPDATE SET
			estado = excluded.estado, error = excluded.error, actualizado_en = excluded.actualizado_en`
	).run(videoId, paso, estado, error ?? null);
}

function estadosDePasos(db: Base, videoId: string): Map<string, EstadoPaso> {
	const filas = db
		.prepare(`SELECT paso, estado FROM video_pasos WHERE video_id = ?`)
		.all(videoId) as Array<{ paso: string; estado: EstadoPaso }>;
	return new Map(filas.map((f) => [f.paso, f.estado]));
}

/**
 * Ejecuta los pasos que no estén hechos, en orden. Un paso que falla no borra lo ya hecho;
 * los que dependen de él quedan pendientes. Al final, el video queda `listo` o `con_errores`.
 */
export async function procesarVideo(
	deps: DependenciasIngesta,
	videoId: string,
	pasos: Paso[] = PASOS
): Promise<void> {
	const carpeta = join(deps.carpetaMedios, videoId);
	await mkdir(carpeta, { recursive: true });
	deps.db
		.prepare(
			`UPDATE videos SET estado = 'procesando', actualizado_en = datetime('now') WHERE id = ?`
		)
		.run(videoId);

	for (const paso of pasos) {
		const estados = estadosDePasos(deps.db, videoId);
		if (estados.get(paso.nombre) === 'hecho') continue;
		if (!paso.requiere.every((r) => estados.get(r) === 'hecho')) {
			marcarPaso(deps.db, videoId, paso.nombre, 'pendiente');
			continue;
		}
		marcarPaso(deps.db, videoId, paso.nombre, 'en_curso');
		try {
			await paso.ejecutar({ ...deps, videoId, carpeta });
			marcarPaso(deps.db, videoId, paso.nombre, 'hecho');
		} catch (error) {
			marcarPaso(deps.db, videoId, paso.nombre, 'fallido', mensajeDeError(error));
		}
	}

	const estados = estadosDePasos(deps.db, videoId);
	const todoHecho = pasos.every((p) => estados.get(p.nombre) === 'hecho');
	deps.db
		.prepare(`UPDATE videos SET estado = ?, actualizado_en = datetime('now') WHERE id = ?`)
		.run(todoHecho ? 'listo' : 'con_errores', videoId);
}

/** Tras un reinicio, lo que estaba en curso no va a terminar: se marca fallido para reintentarlo. */
export function recuperarInterrumpidos(db: Base): void {
	db.transaction(() => {
		db.prepare(
			`UPDATE video_pasos SET estado = 'fallido', error = 'Interrumpido por un reinicio del servidor',
				actualizado_en = datetime('now')
			 WHERE estado = 'en_curso'`
		).run();
		db.prepare(
			`UPDATE videos SET estado = 'con_errores', actualizado_en = datetime('now')
			 WHERE estado = 'procesando'`
		).run();
	})();
}

function mensajeDeError(error: unknown): string {
	const texto = error instanceof Error ? error.message : String(error);
	return texto.slice(0, 500);
}
