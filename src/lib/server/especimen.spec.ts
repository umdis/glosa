import { describe, expect, it } from 'vitest';
import { notaEspecimen } from './especimen';

describe('notaEspecimen', () => {
	it('prefiere la frase que lee el versículo a la que solo nombra el libro', () => {
		const leido =
			'En el versículo Eh doce, en el versículo doce dice Santiago, bienaventurado el varón que soporta la tentación';
		const nombrado = 'Gracias, mijo, muy oportuno. en Santiago en el capítulo uno';
		expect(notaEspecimen(leido, 12)).toBeGreaterThan(notaEspecimen(nombrado, 2));
	});

	it('a igualdad, cada muletilla resta', () => {
		const limpio = 'dice no hagáis daño a la tierra ni al mar ni a los árboles';
		const conMuletillas = 'dice eh eh no hagáis daño a la tierra ni al mar ni a los árboles';
		expect(notaEspecimen(limpio, 3)).toBeGreaterThan(notaEspecimen(conMuletillas, 3));
	});
});
