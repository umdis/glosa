import { execFile } from 'node:child_process';
import { openAsBlob } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { detectarEscritas, type Referencia } from '../biblia/referencias';
import type { Base } from '../db/base';
import type { RutasFfmpeg } from '../medios/ffmpeg';
import { MODELO_RAZONAMIENTO, type ClienteMeta } from '../meta/cliente';

const ejecutar = promisify(execFile);

/**
 * Lo que aparece en pantalla (design.md D5). Medido el 2026-10-27: en tramos de 10 min, Muse
 * Spark da el momento de una diapositiva o una pizarra al segundo; en cambio, se equivoca de
 * 1 a 2 min con lo hablado. Por eso de aquí solo se toman los textos en pantalla.
 */

export interface Tramo {
	archivo: string;
	inicioMs: number;
}

export interface TextoEnPantalla {
	momentoMs: number;
	texto: string;
}

const DURACION_TRAMO_S = 600;

/**
 * Corta el video en tramos de 10 min sin recodificar. El corte cae en fotogramas clave, así que
 * el inicio real de cada tramo se lee de la lista que escribe ffmpeg, no se supone.
 */
export async function cortarEnTramos(
	rutas: RutasFfmpeg,
	video: string,
	carpeta: string
): Promise<Tramo[]> {
	await mkdir(carpeta, { recursive: true });
	const lista = join(carpeta, 'tramos.csv');
	await ejecutar(rutas.ffmpeg, [
		'-v',
		'error',
		'-y',
		'-i',
		video,
		'-c',
		'copy',
		'-map',
		'0',
		'-f',
		'segment',
		'-segment_time',
		String(DURACION_TRAMO_S),
		'-reset_timestamps',
		'1',
		'-segment_list',
		lista,
		'-segment_list_type',
		'csv',
		join(carpeta, 'tramo-%03d.mp4')
	]);
	return leerListaTramos(await readFile(lista, 'utf8'), carpeta);
}

/** Lista CSV de ffmpeg: `archivo,inicio,fin` en segundos. */
export function leerListaTramos(csv: string, carpeta: string): Tramo[] {
	return csv
		.split(/\r?\n/)
		.filter(Boolean)
		.map((linea) => {
			const [archivo, inicio] = linea.split(',');
			return { archivo: join(carpeta, archivo), inicioMs: Math.round(Number(inicio) * 1000) };
		})
		.filter((t) => Number.isFinite(t.inicioMs));
}

const INSTRUCCIONES = `List every piece of text that appears on screen in this video segment: slides, whiteboards, handwritten notes, Bible verses or references, titles shown over the speaker.
- Give the moment each text first appears, as "mm:ss" from the start of this segment.
- If a whiteboard or slide grows (new lines added), list each new version at the moment it appears.
- Copy the text exactly as written, in its language. Ignore logos, watermarks, clocks and video player controls.
- If nothing is written on screen, return an empty list.`;

const ESQUEMA = {
	type: 'json_schema',
	name: 'texto_en_pantalla',
	schema: {
		type: 'object',
		properties: {
			en_pantalla: {
				type: 'array',
				items: {
					type: 'object',
					properties: { t: { type: 'string' }, texto: { type: 'string' } },
					required: ['t', 'texto'],
					additionalProperties: false
				}
			}
		},
		required: ['en_pantalla'],
		additionalProperties: false
	}
};

/** Analiza un tramo: lo sube con caducidad, pregunta a Muse Spark y lo borra siempre. */
export async function analizarTramo(
	meta: Pick<ClienteMeta, 'subirArchivo' | 'borrarArchivo' | 'responses'>,
	tramo: Tramo
): Promise<TextoEnPantalla[]> {
	const archivoId = await meta.subirArchivo(
		await openAsBlob(tramo.archivo, { type: 'video/mp4' }),
		'tramo.mp4'
	);
	try {
		const respuesta = await meta.responses<{ output?: unknown[]; output_text?: string }>(
			{
				model: MODELO_RAZONAMIENTO,
				input: [
					{
						type: 'message',
						role: 'user',
						content: [
							{ type: 'input_text', text: INSTRUCCIONES },
							{ type: 'input_file', file_id: archivoId }
						]
					}
				],
				text: { format: ESQUEMA }
			},
			'analizar_pantalla'
		);
		return leerEnPantalla(textoDeSalida(respuesta), tramo.inicioMs);
	} finally {
		await meta.borrarArchivo(archivoId).catch(() => {
			// Si el borrado falla, el archivo caduca solo (expires_after).
		});
	}
}

/** Texto de una respuesta de la Responses API (output_text o los bloques de salida). */
export function textoDeSalida(respuesta: { output?: unknown[]; output_text?: string }): string {
	if (typeof respuesta.output_text === 'string') return respuesta.output_text;
	return (respuesta.output ?? [])
		.flatMap((o) => {
			const item = o as { type?: string; content?: Array<{ text?: string }> };
			return item.type === 'message' ? (item.content ?? []).map((c) => c.text ?? '') : [];
		})
		.join('');
}

/** Convierte «mm:ss» relativos al tramo en milisegundos absolutos y quita repeticiones seguidas. */
export function leerEnPantalla(contenido: string, inicioTramoMs: number): TextoEnPantalla[] {
	let datos: { en_pantalla?: unknown };
	try {
		datos = JSON.parse(contenido);
	} catch {
		throw new Error('El análisis de pantalla no devolvió JSON válido');
	}
	const resultado: TextoEnPantalla[] = [];
	for (const item of (Array.isArray(datos.en_pantalla) ? datos.en_pantalla : []) as Array<
		Record<string, unknown>
	>) {
		const m = /^(\d{1,2}):(\d{2})$/.exec(String(item?.t ?? '').trim());
		const texto = String(item?.texto ?? '').trim();
		if (!m || !texto) continue;
		const momentoMs = inicioTramoMs + (Number(m[1]) * 60 + Number(m[2])) * 1000;
		if (resultado.at(-1)?.texto === texto) continue;
		resultado.push({ momentoMs, texto: texto.slice(0, 2000) });
	}
	return resultado;
}

/** Guarda los textos en pantalla del video y los pasajes escritos en ellos. */
export function guardarEnPantalla(
	db: Base,
	videoId: string,
	textos: TextoEnPantalla[]
): Array<Referencia & { momentoMs: number }> {
	const insertar = db.prepare(
		`INSERT INTO en_pantalla (video_id, momento_ms, texto) VALUES (?, ?, ?)`
	);
	db.transaction(() => {
		db.prepare(`DELETE FROM en_pantalla WHERE video_id = ?`).run(videoId);
		for (const t of textos) insertar.run(videoId, t.momentoMs, t.texto);
	})();
	// Una misma referencia que sigue en pantalla mientras la pizarra crece se cuenta una vez.
	const vistas = new Set<string>();
	return textos.flatMap((t) =>
		detectarEscritas(t.texto)
			.filter((r) => {
				const clave = `${r.libro} ${r.capitulo}:${r.versiculoInicio}-${r.versiculoFin}`;
				if (vistas.has(clave)) return false;
				vistas.add(clave);
				return true;
			})
			.map((r) => ({ ...r, momentoMs: t.momentoMs }))
	);
}

export async function limpiarTramos(carpeta: string): Promise<void> {
	await rm(carpeta, { recursive: true, force: true });
}
