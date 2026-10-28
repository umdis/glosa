import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);

export interface RutasFfmpeg {
	ffmpeg: string;
	ffprobe: string;
}

export interface InfoMedio {
	duracionMs: number;
	video: { codec: string; ancho: number; alto: number } | undefined;
	audio: { codec: string } | undefined;
}

/** El archivo no sirve como video de Glosa; el mensaje se puede mostrar al usuario. */
export class MedioInvalido extends Error {
	override name = 'MedioInvalido';
}

interface SalidaFfprobe {
	format?: { duration?: string };
	streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }>;
}

/** Lee duración y pistas con ffprobe. Falla si el archivo no es un medio legible. */
export async function probar(rutas: RutasFfmpeg, archivo: string): Promise<InfoMedio> {
	let salida: string;
	try {
		({ stdout: salida } = await ejecutar(rutas.ffprobe, [
			'-v',
			'error',
			'-show_entries',
			'format=duration:stream=codec_type,codec_name,width,height',
			'-of',
			'json',
			archivo
		]));
	} catch {
		throw new MedioInvalido('El archivo no es un video o audio legible');
	}
	const datos = JSON.parse(salida) as SalidaFfprobe;
	const video = datos.streams?.find((s) => s.codec_type === 'video');
	const audio = datos.streams?.find((s) => s.codec_type === 'audio');
	return {
		duracionMs: Math.round(Number(datos.format?.duration ?? 0) * 1000),
		video: video
			? { codec: video.codec_name ?? '?', ancho: video.width ?? 0, alto: video.height ?? 0 }
			: undefined,
		audio: audio ? { codec: audio.codec_name ?? '?' } : undefined
	};
}

/**
 * Versión para reproducir en el navegador y analizar con Muse Spark: H.264 a 480p y AAC mono.
 * Los originales pueden venir en AV1 o VP9, que la API y algunos navegadores no leen.
 */
export async function normalizarVideo(
	rutas: RutasFfmpeg,
	entrada: string,
	salida: string
): Promise<void> {
	await ejecutar(
		rutas.ffmpeg,
		[
			'-v',
			'error',
			'-y',
			'-i',
			entrada,
			'-vf',
			'scale=-2:480',
			'-r',
			'30',
			'-c:v',
			'libx264',
			'-preset',
			'veryfast',
			'-crf',
			'28',
			'-c:a',
			'aac',
			'-b:a',
			'96k',
			'-ac',
			'1',
			'-movflags',
			'+faststart',
			salida
		],
		{ maxBuffer: 10 * 1024 * 1024 }
	);
}

/**
 * Argumentos para sacar un cuadro en JPEG. `-ss` antes de `-i` salta al fotograma clave sin
 * decodificar lo anterior; mjpeg viene en cualquier ffmpeg, libwebp no siempre.
 */
export function argumentosFotograma(
	entrada: string,
	segundo: number,
	ancho: number,
	salida: string
): string[] {
	return [
		'-v',
		'error',
		'-y',
		'-ss',
		String(segundo),
		'-i',
		entrada,
		'-frames:v',
		'1',
		'-vf',
		`scale=${ancho}:-2`,
		'-q:v',
		'4',
		'-f',
		'image2',
		'-c:v',
		'mjpeg',
		salida
	];
}

/** Un cuadro del video en `segundo`, escalado a `ancho` px. */
export async function extraerFotograma(
	rutas: RutasFfmpeg,
	entrada: string,
	segundo: number,
	ancho: number,
	salida: string
): Promise<void> {
	await ejecutar(rutas.ffmpeg, argumentosFotograma(entrada, segundo, ancho, salida));
}

/** Audio para transcribir: WAV PCM de 16 bits, mono, 24 kHz, sin metadatos. */
export async function extraerAudio(
	rutas: RutasFfmpeg,
	entrada: string,
	salida: string
): Promise<void> {
	await ejecutar(rutas.ffmpeg, [
		'-v',
		'error',
		'-y',
		'-i',
		entrada,
		'-vn',
		'-ac',
		'1',
		'-ar',
		'24000',
		'-c:a',
		'pcm_s16le',
		'-map_metadata',
		'-1',
		'-bitexact',
		'-f',
		'wav',
		salida
	]);
}
