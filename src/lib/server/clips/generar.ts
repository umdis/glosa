import { execFile } from 'node:child_process';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Base } from '../db/base';
import { ALTO, ANCHO, DESPLAZAMIENTO_VIDEO, subtitulosClip } from './subtitulos';
import { calcularVentana, type FragmentoDeVideo, type VentanaClip } from './ventana';

const ejecutar = promisify(execFile);

/**
 * Clips verticales (spec clips-compartibles; design.md D5). Un solo paso de ffmpeg: fondo con el
 * mismo video ampliado y difuminado, el video encima, y los subtítulos ASS con la fuente de la
 * casa. Sin fotogramas (SHOW_FRAMES=false), el fondo es un color liso y no se ve a nadie.
 */

/**
 * Ruta como valor de opción dentro de `-filter_complex`: entre comillas simples (nivel del grafo)
 * y con los «:» escapados (nivel de la opción). Así pasa «D:/…» en Windows y «/data/…» en Linux.
 */
export function rutaEnFiltro(ruta: string): string {
	return `'${ruta.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''")}'`;
}

export function argumentosClip(opciones: {
	entrada: string;
	inicioMs: number;
	duracionMs: number;
	subtitulos: string;
	fuentes: string;
	conImagen: boolean;
	salida: string;
}): string[] {
	const segundos = (ms: number) => (ms / 1000).toFixed(3);
	const ass = `ass=${rutaEnFiltro(opciones.subtitulos)}:fontsdir=${rutaEnFiltro(opciones.fuentes)}`;
	const entrada = [
		'-ss',
		segundos(opciones.inicioMs),
		'-t',
		segundos(opciones.duracionMs),
		'-i',
		opciones.entrada
	];
	const filtro = opciones.conImagen
		? `[0:v]split=2[a][b];` +
			`[a]scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=increase,crop=${ANCHO}:${ALTO},gblur=sigma=28,eq=brightness=-0.38:saturation=0.7[fondo];` +
			`[b]scale=${ANCHO}:-2[frente];` +
			// setsar=1: el escalado deja píxeles de 1280:1281 y el navegador lo mostraría a 1922 de alto.
			`[fondo][frente]overlay=0:(H-h)/2${DESPLAZAMIENTO_VIDEO},${ass},setsar=1,format=yuv420p[v]`
		: `[1:v]${ass},setsar=1,format=yuv420p[v]`;
	const fondoLiso = opciones.conImagen
		? []
		: [
				'-f',
				'lavfi',
				'-t',
				segundos(opciones.duracionMs),
				'-i',
				`color=c=0x1f2a28:s=${ANCHO}x${ALTO}:r=30`
			];
	return [
		'-v',
		'error',
		'-y',
		...entrada,
		...fondoLiso,
		'-filter_complex',
		filtro,
		'-map',
		'[v]',
		'-map',
		'0:a?',
		'-r',
		'30',
		'-c:v',
		'libx264',
		'-preset',
		'veryfast',
		'-crf',
		'23',
		'-c:a',
		'aac',
		'-b:a',
		'128k',
		'-movflags',
		'+faststart',
		'-shortest',
		opciones.salida
	];
}

/** Todos los fragmentos del video en orden, con su visibilidad (incluidos los ocultos). */
export function fragmentosDelVideo(db: Base, videoId: string): FragmentoDeVideo[] {
	return (
		db
			.prepare(
				`SELECT id, orden, inicio_ms, fin_ms, texto, visibilidad FROM fragmentos
				 WHERE video_id = ? ORDER BY orden`
			)
			.all(videoId) as Array<{
			id: number;
			orden: number;
			inicio_ms: number;
			fin_ms: number;
			texto: string;
			visibilidad: string;
		}>
	).map((f) => ({
		id: f.id,
		orden: f.orden,
		inicioMs: f.inicio_ms,
		finMs: f.fin_ms,
		texto: f.texto,
		visible: f.visibilidad === 'visible'
	}));
}

export interface ClipPedido {
	videoId: string;
	titulo: string;
	ventana: VentanaClip;
	/** Nombre del archivo en caché: cambia si cambia la ventana o si hay imagen o no. */
	archivo: string;
}

/**
 * Lo que haría falta para el clip de un fragmento, o `null` si no puede haber clip (fragmento
 * oculto, video no publicado o sin 15 s visibles alrededor).
 */
export function pedidoClip(db: Base, fragmentoId: number, conImagen: boolean): ClipPedido | null {
	const fila = db
		.prepare(
			`SELECT f.video_id, v.titulo FROM fragmentos f JOIN videos v ON v.id = f.video_id
			 WHERE f.id = ? AND f.visibilidad = 'visible' AND v.archivo_reproduccion IS NOT NULL`
		)
		.get(fragmentoId) as { video_id: string; titulo: string } | undefined;
	if (!fila) return null;
	const ventana = calcularVentana(fragmentosDelVideo(db, fila.video_id), fragmentoId);
	if (!ventana) return null;
	return {
		videoId: fila.video_id,
		titulo: fila.titulo,
		ventana,
		archivo: `${fragmentoId}-${ventana.inicioMs}-${ventana.finMs}-${conImagen ? 'v' : 'c'}.mp4`
	};
}

export async function existe(ruta: string): Promise<boolean> {
	try {
		return (await stat(ruta)).size > 0;
	} catch {
		return false;
	}
}

export interface DependenciasClip {
	ffmpeg: string;
	carpetaMedios: string;
	fuentes: string;
	conImagen: boolean;
	/** Pie del clip: dónde verlo entero. */
	pie: (pedido: ClipPedido) => string;
}

/**
 * Genera el clip si no está en caché. Escribe en un temporal y renombra: nunca se sirve un
 * archivo a medias.
 */
export async function generarClip(deps: DependenciasClip, pedido: ClipPedido): Promise<string> {
	const carpeta = join(deps.carpetaMedios, pedido.videoId, 'clips');
	const destino = join(carpeta, pedido.archivo);
	if (await existe(destino)) return destino;
	await mkdir(carpeta, { recursive: true });
	const sello = `${process.pid}.${Date.now()}`;
	const subtitulos = join(carpeta, `${pedido.archivo}.${sello}.ass`);
	const temporal = join(carpeta, `${pedido.archivo}.${sello}.tmp.mp4`);
	try {
		await writeFile(
			subtitulos,
			subtitulosClip(pedido.ventana, { titulo: pedido.titulo, pie: deps.pie(pedido) })
		);
		await ejecutar(
			deps.ffmpeg,
			argumentosClip({
				entrada: join(deps.carpetaMedios, pedido.videoId, 'reproduccion.mp4'),
				inicioMs: pedido.ventana.inicioMs,
				duracionMs: pedido.ventana.finMs - pedido.ventana.inicioMs,
				subtitulos,
				fuentes: deps.fuentes,
				conImagen: deps.conImagen,
				salida: temporal
			}),
			{ timeout: 180_000 }
		);
		await rename(temporal, destino);
		return destino;
	} finally {
		await rm(subtitulos, { force: true });
		await rm(temporal, { force: true });
	}
}

/** La cola está llena: se rechaza en vez de hacer esperar sin fin. */
export class ColaLlena extends Error {}

/**
 * Cola de uno en uno con deduplicación (design.md D5): pedir dos veces el mismo clip espera la
 * misma promesa; si ya hay `maximoEspera` trabajos esperando, se rechaza.
 */
export function crearCola(maximoEspera: number) {
	const enCurso = new Map<string, Promise<string>>();
	let cola: Promise<unknown> = Promise.resolve();
	let esperando = 0;
	return {
		encolar(clave: string, trabajo: () => Promise<string>): Promise<string> {
			const existente = enCurso.get(clave);
			if (existente) return existente;
			if (esperando >= maximoEspera) return Promise.reject(new ColaLlena());
			esperando++;
			const promesa = cola.then(
				() => trabajo(),
				() => trabajo()
			);
			cola = promesa.catch(() => undefined);
			const resultado = promesa.finally(() => {
				esperando--;
				enCurso.delete(clave);
			});
			enCurso.set(clave, resultado);
			return resultado;
		},
		get esperando() {
			return esperando;
		}
	};
}
