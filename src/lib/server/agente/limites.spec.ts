import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import type { ResultadoAgente } from './agente';
import { crearLimitador, guardarRespuesta, respuestaGuardada } from './limites';

describe('crearLimitador', () => {
	it('admite el máximo por ventana y vuelve a admitir cuando la ventana pasa', () => {
		let ahora = 0;
		const limitador = crearLimitador(2, 60_000, () => ahora);
		expect(limitador.permitir('1.2.3.4')).toBe(true);
		expect(limitador.permitir('1.2.3.4')).toBe(true);
		expect(limitador.permitir('1.2.3.4')).toBe(false);
		expect(limitador.permitir('5.6.7.8')).toBe(true);
		ahora = 61_000;
		expect(limitador.permitir('1.2.3.4')).toBe(true);
	});
});

describe('respuestas guardadas', () => {
	const resultado = (respaldo: 'respaldada' | 'sin_respaldo'): ResultadoAgente => ({
		pregunta: '¿Qué produce la PRUEBA de la fe?',
		afirmaciones: [{ texto: 'Paciencia.', respaldo, citas: [] }],
		sinEvidencia: false,
		pasos: 2,
		busquedas: ['paciencia']
	});

	it('guarda solo respuestas con evidencia y las encuentra sin importar tildes ni signos', () => {
		const db = abrirBase(':memory:');
		guardarRespuesta(db, resultado('sin_respaldo'));
		expect(respuestaGuardada(db, 'que produce la prueba de la fe')).toBeNull();
		guardarRespuesta(db, resultado('respaldada'));
		expect(respuestaGuardada(db, 'Que produce la prueba de la fe')?.busquedas).toEqual([
			'paciencia'
		]);
	});
});
