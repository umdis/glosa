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

		// El 2 queda entre dos marcados y el 0 y el 4 están junto al bloque: todo se protege.
		expect(visibilidades(db)).toEqual([
			'pendiente',
			'pendiente',
			'pendiente',
			'pendiente',
			'pendiente'
		]);
		expect(listarPendientes(db).map((p) => p.categoria)).toEqual([
			'salud',
			'salud',
			'salud',
			'fallecimiento',
			'fallecimiento'
		]);
		expect(buscar(db, 'Clotilde')).toEqual([]);
	});

	it('caso real del ensayo: protege el fragmento que abre el bloque y un hueco de dos', () => {
		// Marcados por el modelo: 3, 4 y 7. Antes quedaban visibles el 2 (lo abría con un
		// nombre) y el 5 y 6 (hueco de dos). Lo que está lejos del bloque sigue publicándose.
		const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const marcados: Marcado[] = [3, 4, 7].map((id) => ({
			fragmentoId: id,
			categoria: 'salud',
			motivo: 'Petición'
		}));
		const protegidos = rellenarHuecos(marcados, ids)
			.map((m) => m.fragmentoId)
			.sort((a, b) => a - b);
		expect(protegidos).toEqual([2, 3, 4, 5, 6, 7, 8]);
	});

	it('un hueco grande separa dos bloques: lo del medio se publica', () => {
		const ids = Array.from({ length: 12 }, (_, i) => i + 1);
		const marcados: Marcado[] = [2, 10].map((id) => ({
			fragmentoId: id,
			categoria: 'salud',
			motivo: 'Petición'
		}));
		const protegidos = rellenarHuecos(marcados, ids).map((m) => m.fragmentoId);
		expect(protegidos).not.toContain(6);
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
		// Solo cuenta el marcado válido (más sus vecinos, que se protegen); el id inventado y la
		// categoría desconocida se descartan.
		expect(marcados.map((m) => m.fragmentoId).sort((a, b) => a - b)).toEqual([
			ids[0],
			ids[1],
			ids[2]
		]);
		expect(marcados.find((m) => m.fragmentoId === ids[1])?.motivo).toBe('x');
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
