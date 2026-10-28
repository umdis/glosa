import { describe, expect, it } from 'vitest';
import { normalizar, palabrasNormalizadas } from './normalizar';

describe('normalizar', () => {
	it('quita tildes, mayúsculas y puntuación, y conserva la ñ', () => {
		expect(normalizar('¿Tentación? ¡AÑO, niño!')).toBe('tentacion año niño');
		expect(normalizar('Pingüino «Éxodo» 3:14')).toBe('pinguino exodo 3 14');
	});

	it('trata igual la ñ compuesta (n + U+0303) y la precompuesta', () => {
		const compuesta = 'an' + String.fromCodePoint(0x0303) + 'o';
		expect(compuesta).not.toBe('año');
		expect(normalizar(compuesta)).toBe('año');
	});

	it('devuelve una lista vacía para un texto sin palabras', () => {
		expect(palabrasNormalizadas(' — ... ')).toEqual([]);
	});
});
