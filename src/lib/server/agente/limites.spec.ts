import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import type { ResultadoAgente } from './agente';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import { verificarAfirmaciones } from '../verificacion/verificar';
import { crearLimitador, guardarRespuesta, olvidarRespuestas, respuestaGuardada } from './limites';

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
	function preparar() {
		const db = abrirBase(':memory:');
		registrarVideo(db, 'v1', 'Devocional', []);
		guardarFragmentos(db, 'v1', [
			{ inicioMs: 0, finMs: 15_000, texto: 'la prueba de vuestra fe produce paciencia' },
			{ inicioMs: 15_000, finMs: 30_000, texto: 'oremos por los familiares de la hermana Clotilde' }
		]);
		const [paciencia, oracion] = (
			db.prepare(`SELECT id FROM fragmentos ORDER BY orden`).all() as Array<{ id: number }>
		).map((f) => f.id);
		return { db, paciencia, oracion };
	}

	const resultado = (
		pregunta: string,
		citas: Array<{ fragmentoId: number; frase: string }>
	): ResultadoAgente => ({
		pregunta,
		afirmaciones: verificarAfirmaciones(abrirBaseCompartida!, [{ texto: 'Afirmación.', citas }]),
		sinEvidencia: false,
		pasos: 2,
		busquedas: ['paciencia']
	});
	let abrirBaseCompartida: ReturnType<typeof abrirBase> | undefined;

	it('guarda solo respuestas con evidencia y las encuentra sin importar tildes ni signos', () => {
		const { db, paciencia } = preparar();
		abrirBaseCompartida = db;
		guardarRespuesta(db, resultado('¿Qué produce la PRUEBA de la fe?', []));
		expect(respuestaGuardada(db, 'que produce la prueba de la fe')).toBeNull();
		guardarRespuesta(
			db,
			resultado('¿Qué produce la PRUEBA de la fe?', [
				{ fragmentoId: paciencia, frase: 'la prueba de vuestra fe produce paciencia' }
			])
		);
		expect(respuestaGuardada(db, 'Que produce la prueba de la fe')?.busquedas).toEqual([
			'paciencia'
		]);
	});

	it('no sirve una respuesta guardada que cita algo que después se ocultó', () => {
		const { db, oracion } = preparar();
		abrirBaseCompartida = db;
		guardarRespuesta(
			db,
			resultado('¿Por quién oraron?', [
				{ fragmentoId: oracion, frase: 'oremos por los familiares de la hermana Clotilde' }
			])
		);
		// Se oculta por una vía que no borra el caché, para probar la reverificación sola.
		db.prepare(`UPDATE fragmentos SET visibilidad = 'oculto' WHERE id = ?`).run(oracion);
		expect(respuestaGuardada(db, '¿Por quién oraron?')).toBeNull();
	});

	it('cambiar la visibilidad olvida las respuestas guardadas', () => {
		const { db, paciencia } = preparar();
		abrirBaseCompartida = db;
		guardarRespuesta(
			db,
			resultado('¿Qué produce la prueba?', [
				{ fragmentoId: paciencia, frase: 'la prueba de vuestra fe produce paciencia' }
			])
		);
		olvidarRespuestas(db);
		expect(respuestaGuardada(db, '¿Qué produce la prueba?')).toBeNull();
	});
});
