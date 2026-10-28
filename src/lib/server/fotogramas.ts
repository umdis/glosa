import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Los únicos anchos que se generan: acotan la caché y bastan para miniatura y póster. */
export const ANCHOS = [320, 640] as const;
export type Ancho = (typeof ANCHOS)[number];

export function anchoValido(valor: string | null): Ancho {
	return Number(valor) === 640 ? 640 : 320;
}

/**
 * Ajusta el segundo pedido a `[0, duración − 1]`. Sin duración conocida solo se recorta por
 * abajo. Devuelve `null` si no es un número.
 */
export function segundoValido(valor: string, duracionMs: number | null): number | null {
	const segundo = Math.floor(Number(valor));
	if (!Number.isFinite(segundo)) return null;
	const ultimo = duracionMs ? Math.max(0, Math.floor(duracionMs / 1000) - 1) : Infinity;
	return Math.min(Math.max(0, segundo), ultimo);
}

/** El póster: el cuadro en el minuto 1 o al 10 % del video, porque el arranque suele ser negro. */
export function segundoPoster(duracionMs: number | null): number {
	if (!duracionMs) return 0;
	return Math.floor(Math.min(60, (duracionMs / 1000) * 0.1));
}

export interface PedidoFotograma {
	carpetaVideo: string;
	archivoVideo: string;
	segundo: number;
	ancho: Ancho;
	/** Escribe el JPEG en `salida`; en producción, `extraerFotograma` con las rutas de ffmpeg. */
	extraer: (entrada: string, segundo: number, ancho: number, salida: string) => Promise<void>;
}

const enCurso = new Map<string, Promise<string>>();

/**
 * Ruta del JPEG del cuadro pedido, generándolo si no está en caché. Se escribe en un temporal y
 * se renombra, así nunca se sirve un archivo a medias; las peticiones simultáneas por el mismo
 * cuadro esperan la misma promesa.
 */
export async function obtenerFotograma(pedido: PedidoFotograma): Promise<string> {
	const carpeta = join(pedido.carpetaVideo, 'fotogramas');
	const destino = join(carpeta, `${pedido.segundo}-${pedido.ancho}.jpg`);
	if (await existe(destino)) return destino;

	const pendiente = enCurso.get(destino);
	if (pendiente) return pendiente;

	const trabajo = (async () => {
		await mkdir(carpeta, { recursive: true });
		const temporal = `${destino}.${process.pid}.${Date.now()}.tmp`;
		try {
			await pedido.extraer(pedido.archivoVideo, pedido.segundo, pedido.ancho, temporal);
			await rename(temporal, destino);
			return destino;
		} finally {
			await rm(temporal, { force: true });
		}
	})();
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
