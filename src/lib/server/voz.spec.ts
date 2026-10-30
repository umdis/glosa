import { describe, expect, it } from 'vitest';
import { crearWav } from './medios/wav';
import { validarWavVoz } from './voz';

const wav = (
	segundos: number,
	formato = { canales: 1, muestrasPorSegundo: 16_000, bitsPorMuestra: 16 }
) =>
	crearWav(
		formato,
		new Uint8Array(Math.round(segundos * formato.muestrasPorSegundo) * formato.canales * 2)
	);

describe('validarWavVoz', () => {
	it('acepta una pregunta de 4 s en mono, 16 kHz y 16 bits', () => {
		expect(validarWavVoz(wav(4))).toEqual({ ok: true, duracionMs: 4000 });
	});

	it('rechaza lo que no es WAV, otro formato, demasiado corto o más de 30 s', () => {
		expect(validarWavVoz(new TextEncoder().encode('no soy audio')).ok).toBe(false);
		expect(
			validarWavVoz(wav(4, { canales: 2, muestrasPorSegundo: 16_000, bitsPorMuestra: 16 })).ok
		).toBe(false);
		expect(
			validarWavVoz(wav(4, { canales: 1, muestrasPorSegundo: 44_100, bitsPorMuestra: 16 })).ok
		).toBe(false);
		expect(validarWavVoz(wav(0.2)).ok).toBe(false);
		expect(validarWavVoz(wav(32)).ok).toBe(false);
	});
});
