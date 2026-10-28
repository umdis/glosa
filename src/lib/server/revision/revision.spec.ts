import { describe, expect, it } from 'vitest';
import { agenteHerramientasVisibles } from './revision.spec.ayuda';
import { abrirBase } from '../db/base';
import { buscar } from '../busqueda/buscar';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import { decidir, listarPendientes } from './decisiones';
import { fichaAprobada, guardarFicha } from './resumen';
import {
	aplicarClasificacion,
	fragmentosPorClasificar,
	leerMarcados,
	rellenarHuecos,
	type Marcado
} from './sensibles';

function preparar() {
	const db = abrirBase(':memory:');
	registrarVideo(db, 'v1', 'Culto del domingo', []);
	guardarFragmentos(
		db,
		'v1',
		[
			{ inicioMs: 0, finMs: 15_000, texto: 'La paciencia es fruto de la prueba de la fe.' },
			{
				inicioMs: 15_000,
				finMs: 30_000,
				texto: 'Oremos por la hermana Clotilde, operada del corazón.'
			},
			{ inicioMs: 30_000, finMs: 45_000, texto: 'Y también por su esposo que la acompaña.' },
			{
				inicioMs: 45_000,
				finMs: 60_000,
				texto: 'Por la familia de don Luis, que falleció el martes.'
			},
			{ inicioMs: 60_000, finMs: 75_000, texto: 'Dios nos da paciencia en toda prueba.' }
		],
		'pendiente'
	);
	const ids = (
		db.prepare(`SELECT id FROM fragmentos ORDER BY orden`).all() as Array<{ id: number }>
	).map((f) => f.id);
	return { db, ids };
}

const visibilidades = (db: ReturnType<typeof abrirBase>) =>
	(
		db.prepare(`SELECT visibilidad FROM fragmentos ORDER BY orden`).all() as Array<{
			visibilidad: string;
		}>
	).map((f) => f.visibilidad);

describe('segmentos sensibles', () => {
	it('los fragmentos recién transcritos no son públicos hasta clasificarlos', () => {
		const { db } = preparar();
		expect(buscar(db, 'paciencia')).toEqual([]);
	});

	it('publica lo no marcado y deja lo marcado pendiente, en la cola de revisión', () => {
		const { db, ids } = preparar();
		const marcados: Marcado[] = [
			{ fragmentoId: ids[1], categoria: 'salud', motivo: 'Petición por una persona operada' },
			{ fragmentoId: ids[3], categoria: 'fallecimiento', motivo: 'Duelo de una familia' }
		];
		const todos = fragmentosPorClasificar(db, 'v1');
		aplicarClasificacion(
			db,
			'v1',
			todos,
			rellenarHuecos(
				marcados,
				todos.map((f) => f.id)
			)
		);

		// El fragmento 2 queda entre dos marcados: también se protege.
		expect(visibilidades(db)).toEqual([
			'visible',
			'pendiente',
			'pendiente',
			'pendiente',
			'visible'
		]);
		expect(listarPendientes(db).map((p) => p.categoria)).toEqual([
			'salud',
			'salud',
			'fallecimiento'
		]);
		expect(buscar(db, 'paciencia')).toHaveLength(2);
		expect(buscar(db, 'Clotilde')).toEqual([]);
	});

	it('leerMarcados ignora ids inventados y categorías desconocidas', () => {
		const { ids } = preparar();
		const marcados = leerMarcados(
			JSON.stringify({
				marcados: [
					{ fragmento_id: ids[1], categoria: 'salud', motivo: 'x' },
					{ fragmento_id: 999_999, categoria: 'salud', motivo: 'x' },
					{ fragmento_id: ids[3], categoria: 'chisme', motivo: 'x' }
				]
			}),
			ids
		);
		expect(marcados.map((m) => m.fragmentoId)).toEqual([ids[1]]);
	});

	it('una respuesta que no es JSON hace fallar el paso (y todo sigue oculto)', () => {
		expect(() => leerMarcados('lo siento, no puedo', [1])).toThrow(/JSON/);
	});
});

describe('decisiones humanas', () => {
	function conCola() {
		const { db, ids } = preparar();
		const todos = fragmentosPorClasificar(db, 'v1');
		aplicarClasificacion(db, 'v1', todos, [
			{ fragmentoId: ids[1], categoria: 'salud', motivo: 'Petición' }
		]);
		const [pendiente] = listarPendientes(db);
		return { db, ids, pendiente };
	}

	it('ocultar un fragmento lo saca de la búsqueda y del agente, y deja constancia', () => {
		const { db, pendiente } = conCola();
		expect(decidir(db, pendiente.id, 'oculto', 'admin')).toBe(true);
		expect(visibilidades(db)[1]).toBe('oculto');
		expect(agenteHerramientasVisibles(db, 'Clotilde')).toBe(false);
		expect(
			db
				.prepare(`SELECT estado, decidido_por, decidido_en FROM pendientes WHERE id = ?`)
				.get(pendiente.id)
		).toMatchObject({ estado: 'oculto', decidido_por: 'admin', decidido_en: expect.any(String) });
		expect(listarPendientes(db)).toEqual([]);
	});

	it('aprobar un fragmento lo publica', () => {
		const { db, pendiente } = conCola();
		decidir(db, pendiente.id, 'aprobado', 'admin');
		expect(buscar(db, 'Clotilde')).toHaveLength(1);
	});

	it('no se decide dos veces lo mismo', () => {
		const { db, pendiente } = conCola();
		expect(decidir(db, pendiente.id, 'aprobado', 'admin')).toBe(true);
		expect(decidir(db, pendiente.id, 'oculto', 'admin')).toBe(false);
	});

	it('reclasificar no deshace una decisión humana', () => {
		const { db, ids, pendiente } = conCola();
		decidir(db, pendiente.id, 'aprobado', 'admin');
		const porClasificar = fragmentosPorClasificar(db, 'v1').map((f) => f.id);
		expect(porClasificar).not.toContain(ids[1]);
	});
});

describe('ficha del video', () => {
	it('el resumen propuesto no es público hasta aprobarlo', () => {
		const { db } = preparar();
		guardarFicha(db, 'v1', { resumen: 'Enseña sobre la paciencia.', temas: ['paciencia', 'fe'] });
		expect(fichaAprobada(db, 'v1')).toEqual({ resumen: null, temas: [] });
		for (const p of listarPendientes(db)) decidir(db, p.id, 'aprobado', 'admin');
		expect(fichaAprobada(db, 'v1')).toEqual({
			resumen: 'Enseña sobre la paciencia.',
			temas: ['paciencia', 'fe']
		});
	});
});
