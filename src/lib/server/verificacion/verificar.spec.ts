import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import { mejorAlineacion, verificarAfirmaciones, type CitaVerificada } from './verificar';

/** Fragmentos con el estilo real de la transcripción: muletillas y repeticiones incluidas. */
function preparar() {
	const db = abrirBase(':memory:');
	registrarVideo(db, 'v1', 'Devocional', []);
	guardarFragmentos(db, 'v1', [
		{ inicioMs: 356_000, finMs: 367_000, texto: 'Santiago capítulo uno eh hay una' },
		{
			inicioMs: 369_000,
			finMs: 382_000,
			texto: 'hay una expresión muy muy válida del sentido de la tentación,'
		},
		{
			inicioMs: 383_000,
			finMs: 399_000,
			texto:
				'en en el versículo dos dice hermanos míos tened por sumo gozo cuando os halléis en diversas pruebas sabiendo'
		},
		{
			inicioMs: 402_000,
			finMs: 419_000,
			texto:
				'que la prueba de vuestra fe produce paciencia, mas tenga la paciencia su obra completa'
		},
		{
			inicioMs: 419_000,
			finMs: 439_000,
			texto: 'Yo quiero que entiendan que el término prueba eh incluye las tentaciones'
		}
	]);
	const id = (orden: number) =>
		(db.prepare(`SELECT id FROM fragmentos WHERE orden = ?`).get(orden) as { id: number }).id;
	const verificar = (fragmentoId: number, frase: string, extra: object = {}) =>
		verificarAfirmaciones(db, [{ texto: 'x', citas: [{ fragmentoId, frase, ...extra }] }])[0]
			.citas[0];
	return { db, id, verificar };
}

const verificada = (c: CitaVerificada) => (c.estado === 'verificada' ? c : undefined);

describe('verificación de citas', () => {
	it('verifica una cita textual y la ancla al inicio de su fragmento', () => {
		const { id, verificar } = preparar();
		const cita = verificar(id(2), 'hermanos míos, tened por sumo gozo');
		expect(cita.estado).toBe('verificada');
		expect(verificada(cita)?.inicioMs).toBe(383_000);
		expect(verificada(cita)?.titulo).toBe('Devocional');
	});

	it('tolera que el modelo quite las muletillas al citar', () => {
		const { id, verificar } = preparar();
		// En el audio: «en en el versículo dos dice…»
		expect(verificar(id(2), 'en el versículo dos dice hermanos míos').estado).toBe('verificada');
	});

	it('ancla la cita al fragmento vecino donde realmente está', () => {
		const { id, verificar } = preparar();
		const cita = verificar(id(2), 'la prueba de vuestra fe produce paciencia');
		expect(verificada(cita)?.fragmentoId).toBe(id(3));
		expect(verificada(cita)?.inicioMs).toBe(402_000);
	});

	it('verifica una frase que cruza el borde entre dos fragmentos y la ancla donde empieza', () => {
		const { id, verificar } = preparar();
		const cita = verificar(id(3), 'en diversas pruebas sabiendo que la prueba de vuestra fe');
		expect(verificada(cita)?.inicioMs).toBe(383_000);
	});

	it('marca como no verificada una cita inventada', () => {
		const { id, verificar } = preparar();
		const cita = verificar(id(2), 'la paciencia es la madre de todas las ciencias');
		expect(cita).toMatchObject({ estado: 'no_verificada', motivo: 'no_encontrada' });
	});

	it('no busca más allá de los vecinos: una frase real, pero lejana, no se verifica', () => {
		const { id, verificar } = preparar();
		// La frase está en el fragmento 4; se cita el 1, a tres de distancia.
		expect(verificar(id(1), 'el término prueba incluye las tentaciones').estado).toBe(
			'no_verificada'
		);
	});

	it('no acepta palabras de la frase desperdigadas por el fragmento', () => {
		expect(
			mejorAlineacion(
				['tened', 'paciencia', 'hermanos', 'fe'],
				'tened por sumo gozo cuando os halléis en diversas pruebas la fe de los hermanos produce paciencia'.split(
					' '
				)
			).coincidencia
		).toBeLessThan(0.85);
	});

	it('ignora el minuto que proponga el modelo: el minuto sale del fragmento', () => {
		const { id, verificar } = preparar();
		const cita = verificar(id(2), 'tened por sumo gozo cuando os halléis', { minuto: '09:00' });
		expect(verificada(cita)?.inicioMs).toBe(383_000);
		expect(cita).not.toHaveProperty('minuto');
	});

	it('una frase demasiado corta no sirve como respaldo', () => {
		const { id, verificar } = preparar();
		expect(verificar(id(2), 'hermanos')).toMatchObject({
			estado: 'no_verificada',
			motivo: 'demasiado_corta'
		});
	});

	it('no se puede citar un fragmento pendiente de revisión ni uno inexistente', () => {
		const { db, id, verificar } = preparar();
		db.prepare(`UPDATE fragmentos SET visibilidad = 'pendiente' WHERE id = ?`).run(id(2));
		expect(verificar(id(2), 'tened por sumo gozo cuando os halléis')).toMatchObject({
			estado: 'no_verificada',
			motivo: 'fragmento_inexistente'
		});
		expect(verificar(999_999, 'tened por sumo gozo cuando os halléis')).toMatchObject({
			motivo: 'fragmento_inexistente'
		});
	});

	it('una afirmación sin ninguna cita verificada queda sin respaldo', () => {
		const { db, id } = preparar();
		const [conRespaldo, sinRespaldo] = verificarAfirmaciones(db, [
			{
				texto: 'La prueba produce paciencia.',
				citas: [
					{ fragmentoId: id(3), frase: 'la prueba de vuestra fe produce paciencia' },
					{ fragmentoId: id(3), frase: 'una frase que nadie dijo nunca aquí' }
				]
			},
			{
				texto: 'Lutero escribió noventa y cinco tesis.',
				citas: [{ fragmentoId: id(1), frase: 'Lutero clavó noventa y cinco tesis' }]
			}
		]);
		expect(conRespaldo.respaldo).toBe('respaldada');
		expect(conRespaldo.citas.map((c) => c.estado)).toEqual(['verificada', 'no_verificada']);
		expect(sinRespaldo.respaldo).toBe('sin_respaldo');
	});

	it('el umbral es configurable', () => {
		const { db, id } = preparar();
		const frase = 'tened por sumo gozo cuando os halléis en grandes tribulaciones';
		const con = (umbral: number) =>
			verificarAfirmaciones(db, [{ texto: 'x', citas: [{ fragmentoId: id(2), frase }] }], {
				umbral
			})[0].citas[0].estado;
		expect(con(0.85)).toBe('no_verificada');
		expect(con(0.7)).toBe('verificada');
	});
});
