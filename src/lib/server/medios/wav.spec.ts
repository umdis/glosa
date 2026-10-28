import { describe, expect, it } from 'vitest';
import { cortarEnVentanas, crearWav, duracionWavMs, leerFormatoWav } from './wav';

const FORMATO = { canales: 1, muestrasPorSegundo: 24_000, bitsPorMuestra: 16 };

/** WAV de `segundos` en el que cada muestra guarda el segundo al que pertenece. */
function wavDePrueba(segundos: number): Uint8Array {
	const muestras = new Int16Array(segundos * FORMATO.muestrasPorSegundo);
	muestras.forEach((_, i) => (muestras[i] = Math.floor(i / FORMATO.muestrasPorSegundo)));
	return crearWav(FORMATO, new Uint8Array(muestras.buffer));
}

const primeraMuestra = (wav: Uint8Array) =>
	new DataView(wav.buffer, wav.byteOffset).getInt16(leerFormatoWav(wav).inicioDatos, true);

describe('wav', () => {
	it('lee el formato y la duración de un WAV PCM', () => {
		const wav = wavDePrueba(3);
		expect(leerFormatoWav(wav)).toMatchObject({ ...FORMATO, inicioDatos: 44 });
		expect(duracionWavMs(wav)).toBe(3_000);
	});

	it('salta bloques intermedios como LIST', () => {
		const base = wavDePrueba(1);
		const list = new Uint8Array(
			[...'LIST'].map((c) => c.charCodeAt(0)).concat([4, 0, 0, 0, 1, 2, 3, 4])
		);
		const conList = new Uint8Array([...base.subarray(0, 36), ...list, ...base.subarray(36)]);
		expect(leerFormatoWav(conList).inicioDatos).toBe(44 + list.length);
	});

	it('rechaza lo que no es WAV', () => {
		expect(() => leerFormatoWav(new Uint8Array(64))).toThrow(/RIFF/);
	});

	it('corta en ventanas solapadas que cubren todo el audio', () => {
		const ventanas = cortarEnVentanas(wavDePrueba(70), 30_000, 5_000);
		expect(ventanas.map((v) => [v.inicioMs, v.duracionMs])).toEqual([
			[0, 30_000],
			[25_000, 30_000],
			[50_000, 20_000]
		]);
		// Cada ventana empieza en el segundo correcto del audio original.
		expect(ventanas.map((v) => primeraMuestra(v.wav))).toEqual([0, 25, 50]);
		expect(duracionWavMs(ventanas[1].wav)).toBe(30_000);
	});

	it('no admite un solape mayor o igual que la ventana', () => {
		expect(() => cortarEnVentanas(wavDePrueba(1), 5_000, 5_000)).toThrow();
	});
});
