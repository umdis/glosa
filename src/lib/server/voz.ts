import { leerFormatoWav } from './medios/wav';

/**
 * Pregunta por voz (spec idiomas-y-voz; design.md D7 de glosa-competitiva). El navegador manda un
 * WAV PCM mono de 16 kHz y 16 bits; aquí se comprueba antes de gastar una llamada. El audio no se
 * guarda en ningún sitio.
 */

export const MAXIMO_SEGUNDOS_VOZ = 30;
/** 30 s de PCM a 16 kHz y 16 bits son ~960 KB; se deja margen para la cabecera. */
export const MAXIMO_BYTES_VOZ = 1_100_000;

export type WavVoz = { ok: true; duracionMs: number } | { ok: false; error: string };

export function validarWavVoz(bytes: Uint8Array): WavVoz {
	if (bytes.byteLength > MAXIMO_BYTES_VOZ) {
		return { ok: false, error: `Recordings are limited to ${MAXIMO_SEGUNDOS_VOZ} seconds.` };
	}
	let formato;
	try {
		formato = leerFormatoWav(bytes);
	} catch {
		return { ok: false, error: 'The recording is not a WAV file Glosa can read.' };
	}
	if (
		formato.canales !== 1 ||
		formato.muestrasPorSegundo !== 16_000 ||
		formato.bitsPorMuestra !== 16
	) {
		return { ok: false, error: 'The recording must be mono, 16 kHz, 16-bit audio.' };
	}
	const duracionMs = Math.round((formato.bytesDatos / 2 / 16_000) * 1000);
	if (duracionMs < 500) return { ok: false, error: 'The recording is too short. Try again.' };
	if (duracionMs > MAXIMO_SEGUNDOS_VOZ * 1000 + 500) {
		return { ok: false, error: `Recordings are limited to ${MAXIMO_SEGUNDOS_VOZ} seconds.` };
	}
	return { ok: true, duracionMs };
}
