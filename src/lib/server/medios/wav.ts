/**
 * Lectura y corte de WAV PCM en memoria. Cortar bytes es mucho más rápido que lanzar ffmpeg
 * por cada ventana, y el audio que sale de `extraerAudio` es siempre PCM de 16 bits mono.
 */
export interface FormatoWav {
	canales: number;
	muestrasPorSegundo: number;
	bitsPorMuestra: number;
	/** Posición y tamaño del bloque de datos dentro del archivo. */
	inicioDatos: number;
	bytesDatos: number;
}

export interface VentanaWav {
	/** Inicio absoluto de la ventana dentro del audio original. */
	inicioMs: number;
	duracionMs: number;
	wav: Uint8Array;
}

export function leerFormatoWav(bytes: Uint8Array): FormatoWav {
	const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const etiqueta = (pos: number) => String.fromCharCode(...bytes.subarray(pos, pos + 4));
	if (etiqueta(0) !== 'RIFF' || etiqueta(8) !== 'WAVE') throw new Error('No es un WAV RIFF');

	let formato: Omit<FormatoWav, 'inicioDatos' | 'bytesDatos'> | undefined;
	let pos = 12;
	while (pos + 8 <= bytes.byteLength) {
		const id = etiqueta(pos);
		const tamano = vista.getUint32(pos + 4, true);
		if (id === 'fmt ') {
			const codigo = vista.getUint16(pos + 8, true);
			if (codigo !== 1) throw new Error(`WAV no es PCM (formato ${codigo})`);
			formato = {
				canales: vista.getUint16(pos + 10, true),
				muestrasPorSegundo: vista.getUint32(pos + 12, true),
				bitsPorMuestra: vista.getUint16(pos + 22, true)
			};
		} else if (id === 'data') {
			if (!formato) throw new Error('WAV sin bloque fmt antes de data');
			const bytesDatos = Math.min(tamano, bytes.byteLength - (pos + 8));
			return { ...formato, inicioDatos: pos + 8, bytesDatos };
		}
		pos += 8 + tamano + (tamano % 2);
	}
	throw new Error('WAV sin bloque data');
}

/** Crea un WAV PCM con la cabecera mínima de 44 bytes. */
export function crearWav(
	formato: Pick<FormatoWav, 'canales' | 'muestrasPorSegundo' | 'bitsPorMuestra'>,
	datos: Uint8Array
): Uint8Array {
	const salida = new Uint8Array(44 + datos.byteLength);
	const vista = new DataView(salida.buffer);
	const escribir = (pos: number, texto: string) =>
		[...texto].forEach((c, i) => (salida[pos + i] = c.charCodeAt(0)));
	const bytesPorMuestra = formato.bitsPorMuestra / 8;
	escribir(0, 'RIFF');
	vista.setUint32(4, 36 + datos.byteLength, true);
	escribir(8, 'WAVE');
	escribir(12, 'fmt ');
	vista.setUint32(16, 16, true);
	vista.setUint16(20, 1, true);
	vista.setUint16(22, formato.canales, true);
	vista.setUint32(24, formato.muestrasPorSegundo, true);
	vista.setUint32(28, formato.muestrasPorSegundo * formato.canales * bytesPorMuestra, true);
	vista.setUint16(32, formato.canales * bytesPorMuestra, true);
	vista.setUint16(34, formato.bitsPorMuestra, true);
	escribir(36, 'data');
	vista.setUint32(40, datos.byteLength, true);
	salida.set(datos, 44);
	return salida;
}

/** Duración total del audio en milisegundos. */
export function duracionWavMs(bytes: Uint8Array): number {
	const f = leerFormatoWav(bytes);
	const bytesPorSegundo = f.muestrasPorSegundo * f.canales * (f.bitsPorMuestra / 8);
	return Math.floor((f.bytesDatos / bytesPorSegundo) * 1000);
}

/**
 * Corta el audio en ventanas de `ventanaMs` que se solapan `solapeMs`. La última ventana
 * puede ser más corta. El solape permite recuperar las palabras cortadas en los bordes.
 */
export function cortarEnVentanas(
	bytes: Uint8Array,
	ventanaMs = 30_000,
	solapeMs = 5_000
): VentanaWav[] {
	if (solapeMs >= ventanaMs) throw new Error('El solape debe ser menor que la ventana');
	const f = leerFormatoWav(bytes);
	const bytesPorBloque = f.canales * (f.bitsPorMuestra / 8);
	const muestrasPorMs = f.muestrasPorSegundo / 1000;
	const totalMuestras = Math.floor(f.bytesDatos / bytesPorBloque);
	const totalMs = Math.floor(totalMuestras / muestrasPorMs);
	const paso = ventanaMs - solapeMs;

	const ventanas: VentanaWav[] = [];
	for (let inicioMs = 0; inicioMs < totalMs; inicioMs += paso) {
		const finMs = Math.min(inicioMs + ventanaMs, totalMs);
		const desde = f.inicioDatos + Math.floor(inicioMs * muestrasPorMs) * bytesPorBloque;
		const hasta = f.inicioDatos + Math.floor(finMs * muestrasPorMs) * bytesPorBloque;
		ventanas.push({
			inicioMs,
			duracionMs: finMs - inicioMs,
			wav: crearWav(f, bytes.subarray(desde, hasta))
		});
		if (finMs >= totalMs) break;
	}
	return ventanas;
}
