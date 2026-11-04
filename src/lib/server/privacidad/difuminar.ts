import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import type { ClienteMeta } from '../meta/cliente';

/**
 * Privacidad visual (spec privacidad-visual; design.md D11). SAM 3.1 encuentra a las personas
 * del fotograma; se difumina a todas salvo al orador.
 *
 * Desviación de D11, decidida tras el reconocimiento del 2026-11-04: se difumina la **caja** de
 * cada persona, no su máscara. La máscara llega en un base85 propio sin decodificador publicado,
 * y una caja con margen tapa igual (o más) a quien no habla. El orador tampoco es «la máscara
 * más grande»: en un plano desde el fondo, las personas del primer plano son las más grandes.
 */

const ejecutar = promisify(execFile);

export interface Caja {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	/** Confianza 0–1, si SAM la devolvió. */
	c?: number;
}

export interface Segmentacion {
	ancho: number;
	alto: number;
	cajas: Caja[];
}

/** Lee las cajas de la salida de SAM: `<0f>0<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..;c=..|><|mask;…|>,1<|box;…`. */
export function leerCajas(texto: string): Segmentacion {
	const cajas: Caja[] = [];
	let ancho = 0;
	let alto = 0;
	for (const m of texto.matchAll(/<\|box;([^|]*)\|>/g)) {
		const campos = Object.fromEntries(
			m[1].split(';').map((par) => {
				const [k, v] = par.split('=');
				return [k, Number(v)];
			})
		) as Record<string, number>;
		const { x1, y1, x2, y2, w, h, c } = campos;
		if (![x1, y1, x2, y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) continue;
		if (w > 0) ancho = w;
		if (h > 0) alto = h;
		cajas.push({ x1, y1, x2, y2, ...(Number.isFinite(c) ? { c } : {}) });
	}
	return { ancho, alto, cajas };
}

/**
 * El orador: entre las personas centradas en horizontal (centro en el tercio medio), la que
 * empieza más arriba, porque está de pie y el público sentado queda más abajo; a igual altura,
 * la más grande. Si nadie está en el tercio medio, nadie es orador y se difumina a todos: ante
 * la duda, se protege.
 */
export function elegirOrador(seg: Segmentacion): number | null {
	let elegido: number | null = null;
	seg.cajas.forEach((caja, i) => {
		const centro = (caja.x1 + caja.x2) / 2;
		if (centro < seg.ancho / 3 || centro > (seg.ancho * 2) / 3) return;
		if (elegido === null) {
			elegido = i;
			return;
		}
		const actual = seg.cajas[elegido];
		const area = (k: Caja) => (k.x2 - k.x1) * (k.y2 - k.y1);
		if (
			caja.y1 < actual.y1 - 2 ||
			(Math.abs(caja.y1 - actual.y1) <= 2 && area(caja) > area(actual))
		)
			elegido = i;
	});
	return elegido;
}

/** Margen alrededor de cada caja (proporción de su lado): pelo, manos y hombros que sobresalen. */
const MARGEN = 0.08;

/**
 * Filtro de ffmpeg que difumina las cajas dadas: un solo desenfoque de toda la imagen, del que
 * se recortan los rectángulos y se pegan encima del original. `null` si no hay nada que tapar.
 */
export function filtroDifuminado(seg: Segmentacion, tapar: Caja[]): string | null {
	if (tapar.length === 0) return null;
	const par = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
	const rectangulos = tapar.map((k) => {
		const mx = (k.x2 - k.x1) * MARGEN;
		const my = (k.y2 - k.y1) * MARGEN;
		const x = Math.max(0, Math.floor(k.x1 - mx));
		const y = Math.max(0, Math.floor(k.y1 - my));
		const x2 = Math.min(seg.ancho, Math.ceil(k.x2 + mx));
		const y2 = Math.min(seg.alto, Math.ceil(k.y2 + my));
		return { x, y, w: par(x2 - x), h: par(y2 - y) };
	});
	const n = rectangulos.length;
	const salidas = rectangulos.map((_, i) => `[d${i}]`).join('');
	let filtro = `[0:v]split=2[base][borroso];[borroso]gblur=sigma=24,split=${n}${salidas};`;
	rectangulos.forEach((r, i) => {
		filtro += `[d${i}]crop=${r.w}:${r.h}:${r.x}:${r.y}[r${i}];`;
	});
	let anterior = '[base]';
	rectangulos.forEach((r, i) => {
		const siguiente = i === n - 1 ? '[v]' : `[t${i}]`;
		filtro += `${anterior}[r${i}]overlay=${r.x}:${r.y}${siguiente};`;
		anterior = siguiente;
	});
	return filtro.slice(0, -1);
}

export interface DependenciasDifuminar {
	meta: Pick<ClienteMeta, 'segmentar'>;
	ffmpeg: string;
}

/** Qué se hizo con un fotograma: para la vista del editor y las pruebas. */
export interface ResultadoDifuminado {
	personas: number;
	orador: boolean;
	difuminadas: number;
}

/**
 * Escribe en `salida` el fotograma `original` con todas las personas difuminadas salvo el orador.
 * Si SAM o ffmpeg fallan, lanza: quien llama no debe servir el original (spec: «se muestra el
 * minuto»). Escribe a un temporal y renombra.
 */
export async function difuminarFotograma(
	deps: DependenciasDifuminar,
	original: string,
	salida: string
): Promise<ResultadoDifuminado> {
	const jpeg = new Uint8Array(await readFile(original));
	const seg = leerCajas(await deps.meta.segmentar(jpeg, 'person'));
	const orador = elegirOrador(seg);
	const tapar = seg.cajas.filter((_, i) => i !== orador);
	await mkdir(dirname(salida), { recursive: true });
	const temporal = `${salida}.${process.pid}.${Date.now()}.tmp.jpg`;
	try {
		const filtro = seg.ancho && seg.alto ? filtroDifuminado(seg, tapar) : null;
		const argumentos = filtro
			? ['-y', '-loglevel', 'error', '-i', original, '-filter_complex', filtro, '-map', '[v]']
			: ['-y', '-loglevel', 'error', '-i', original];
		await ejecutar(deps.ffmpeg, [...argumentos, '-frames:v', '1', '-q:v', '3', temporal], {
			timeout: 60_000
		});
		await rename(temporal, salida);
	} finally {
		await rm(temporal, { force: true });
	}
	return { personas: seg.cajas.length, orador: orador !== null, difuminadas: tapar.length };
}

const enCurso = new Map<string, Promise<string>>();

/**
 * Ruta del fotograma difuminado, generándolo si no está en caché (spec: «se sirve el difuminado
 * guardado sin llamar a SAM»). Las peticiones simultáneas por el mismo cuadro comparten trabajo.
 * `permitirLlamada` es el tope de gasto: si no hay caché y no se puede gastar, lanza.
 */
export async function obtenerDifuminado(
	deps: DependenciasDifuminar,
	original: string,
	destino: string,
	permitirLlamada: () => boolean
): Promise<string> {
	if (await existe(destino)) return destino;
	const pendiente = enCurso.get(destino);
	if (pendiente) return pendiente;
	if (!permitirLlamada()) throw new Error('Tope de gasto alcanzado: sin difuminado nuevo');
	const trabajo = difuminarFotograma(deps, original, destino).then(() => destino);
	enCurso.set(destino, trabajo);
	try {
		return await trabajo;
	} finally {
		enCurso.delete(destino);
	}
}

async function existe(ruta: string): Promise<boolean> {
	try {
		return (await stat(ruta)).size > 0;
	} catch {
		return false;
	}
}
