import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBase, type Base } from '../db/base';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import {
	ErrorInvestigacion,
	LIMITES,
	anadirCita,
	anadirTexto,
	bloquesDe,
	borrarBloque,
	crearInvestigacion,
	editarBloque,
	listarPublicadas,
	moverBloque,
	obtenerInvestigacion,
	publicar,
	puedeEditar,
	retirar
} from './datos';

let db: Base;
let fragmentos: number[];

beforeEach(() => {
	db = abrirBase(':memory:');
	registrarVideo(db, 'v1', 'Criar hijos con valores', []);
	guardarFragmentos(db, 'v1', [
		{
			inicioMs: 0,
			finMs: 10_000,
			texto: 'Hermanos, hoy hablamos de criar a los hijos con valores'
		},
		{
			inicioMs: 10_000,
			finMs: 20_000,
			texto: 'El perdón empieza en la casa, en la mesa de todos los días'
		}
	]);
	db.prepare(`UPDATE videos SET archivo_reproduccion = 'reproduccion.mp4'`).run();
	fragmentos = (
		db.prepare(`SELECT id FROM fragmentos ORDER BY orden`).all() as Array<{ id: number }>
	).map((f) => f.id);
});

describe('crear y editar', () => {
	it('solo el secreto devuelto permite editar, y no se guarda en claro', () => {
		const { id, secreto } = crearInvestigacion(db, '  Familia   y perdón ');
		expect(obtenerInvestigacion(db, id)?.titulo).toBe('Familia y perdón');
		expect(puedeEditar(db, id, secreto)).toBe(true);
		expect(puedeEditar(db, id, secreto.slice(1) + 'x')).toBe(false);
		expect(puedeEditar(db, id, undefined)).toBe(false);
		expect(puedeEditar(db, 'noexiste00', secreto)).toBe(false);
		const fila = db.prepare(`SELECT secreto_hash FROM investigaciones`).get() as {
			secreto_hash: string;
		};
		expect(fila.secreto_hash).not.toContain(secreto);
	});

	it('rechaza títulos vacíos o demasiado largos', () => {
		expect(() => crearInvestigacion(db, '   ')).toThrow(ErrorInvestigacion);
		expect(() => crearInvestigacion(db, 'x'.repeat(LIMITES.titulo + 1))).toThrow(
			ErrorInvestigacion
		);
	});

	it('añade bloques en orden, edita el texto y quita la marca de IA al editar', () => {
		const { id } = crearInvestigacion(db, 'Estudio');
		anadirTexto(db, id, 'titulo', 'Introducción');
		const parrafo = anadirTexto(db, id, 'texto', 'Borrador de Spark', true);
		anadirCita(db, id, fragmentos[1], 'El perdón empieza en la casa');
		expect(bloquesDe(db, id).map((b) => b.tipo)).toEqual(['titulo', 'texto', 'cita']);
		expect(bloquesDe(db, id)[1].origenIa).toBe(true);

		editarBloque(db, id, parrafo, 'Texto propio');
		const editado = bloquesDe(db, id)[1];
		expect(editado.tipo === 'texto' && editado.texto).toBe('Texto propio');
		expect(editado.origenIa).toBe(false);
	});

	it('no deja editar citas ni bloques de otra investigación', () => {
		const a = crearInvestigacion(db, 'A');
		const b = crearInvestigacion(db, 'B');
		const cita = anadirCita(db, a.id, fragmentos[0], '');
		const nota = anadirTexto(db, a.id, 'nota', 'nota');
		expect(() => editarBloque(db, a.id, cita, 'otra cosa')).toThrow(ErrorInvestigacion);
		expect(() => editarBloque(db, b.id, nota, 'ajeno')).toThrow(ErrorInvestigacion);
		borrarBloque(db, b.id, nota);
		expect(bloquesDe(db, a.id)).toHaveLength(2);
	});

	it('respeta el máximo de bloques', () => {
		const { id } = crearInvestigacion(db, 'Larga');
		for (let i = 0; i < LIMITES.bloques; i++) anadirTexto(db, id, 'nota', `nota ${i}`);
		expect(() => anadirTexto(db, id, 'nota', 'una más')).toThrow(ErrorInvestigacion);
	});
});

describe('citas', () => {
	it('sin frase guarda el fragmento entero y no admite la misma cita dos veces', () => {
		const { id } = crearInvestigacion(db, 'Citas');
		anadirCita(db, id, fragmentos[0], '');
		const [b] = bloquesDe(db, id);
		expect(b.tipo === 'cita' && b.cita).toMatchObject({
			frase: 'Hermanos, hoy hablamos de criar a los hijos con valores',
			videoId: 'v1',
			titulo: 'Criar hijos con valores',
			inicioMs: 0
		});
		expect(() => anadirCita(db, id, fragmentos[0], '')).toThrow(ErrorInvestigacion);
	});

	it('rechaza una frase que no se dijo en ese fragmento', () => {
		const { id } = crearInvestigacion(db, 'Citas');
		expect(() =>
			anadirCita(db, id, fragmentos[0], 'el divorcio es la mejor solución para todos')
		).toThrow('does not match');
		expect(bloquesDe(db, id)).toEqual([]);
	});

	it('una frase que empieza en el fragmento vecino toma el minuto del vecino', () => {
		const { id } = crearInvestigacion(db, 'Citas');
		anadirCita(db, id, fragmentos[0], 'El perdón empieza en la casa, en la mesa');
		const [b] = bloquesDe(db, id);
		expect(b.tipo === 'cita' && b.cita).toMatchObject({
			fragmentoId: fragmentos[1],
			inicioMs: 10_000
		});
	});

	it('la IA puede repetir una cita que ya está; una persona no', () => {
		const { id } = crearInvestigacion(db, 'Citas');
		anadirCita(db, id, fragmentos[1], 'El perdón empieza en la casa');
		expect(() => anadirCita(db, id, fragmentos[1], 'El perdón empieza en la casa')).toThrow(
			ErrorInvestigacion
		);
		anadirCita(db, id, fragmentos[1], 'El perdón empieza en la casa', true);
		expect(bloquesDe(db, id)).toHaveLength(2);
	});

	it('no acepta fragmentos ocultos ni pendientes', () => {
		const { id } = crearInvestigacion(db, 'Citas');
		db.prepare(`UPDATE fragmentos SET visibilidad = 'pendiente' WHERE id = ?`).run(fragmentos[0]);
		expect(() => anadirCita(db, id, fragmentos[0], '')).toThrow(ErrorInvestigacion);
	});

	it('una cita cuyo fragmento se oculta después queda retirada y sin texto', () => {
		const { id } = crearInvestigacion(db, 'Citas');
		anadirCita(db, id, fragmentos[1], 'El perdón empieza en la casa');
		db.prepare(`UPDATE fragmentos SET visibilidad = 'oculto' WHERE id = ?`).run(fragmentos[1]);
		const [b] = bloquesDe(db, id);
		expect(b.tipo).toBe('cita');
		expect(b.tipo === 'cita' && b.cita).toBeNull();
	});

	it('borrar el video retira la cita sin romper la investigación', () => {
		const { id } = crearInvestigacion(db, 'Citas');
		anadirCita(db, id, fragmentos[0], '');
		db.prepare(`DELETE FROM videos WHERE id = 'v1'`).run();
		const [b] = bloquesDe(db, id);
		expect(b.tipo === 'cita' && b.cita).toBeNull();
	});
});

describe('mover', () => {
	it('sube y baja de a una posición y se queda en los extremos', () => {
		const { id } = crearInvestigacion(db, 'Orden');
		const [a, b, c] = ['uno', 'dos', 'tres'].map((t) => anadirTexto(db, id, 'nota', t));
		expect(moverBloque(db, id, c, 'arriba')).toEqual({ posicion: 2, total: 3 });
		expect(bloquesDe(db, id).map((x) => x.id)).toEqual([a, c, b]);
		expect(moverBloque(db, id, a, 'arriba')).toEqual({ posicion: 1, total: 3 });
		expect(moverBloque(db, id, b, 'abajo')).toEqual({ posicion: 3, total: 3 });
		expect(bloquesDe(db, id).map((x) => x.id)).toEqual([a, c, b]);
	});
});

describe('publicar', () => {
	it('publica, y si el editor la retira el autor ya no puede volver a publicarla', () => {
		const { id } = crearInvestigacion(db, 'Pública');
		publicar(db, id, true);
		expect(obtenerInvestigacion(db, id)?.publicada).toBe(true);
		expect(listarPublicadas(db).map((p) => p.id)).toEqual([id]);

		retirar(db, id);
		expect(obtenerInvestigacion(db, id)).toMatchObject({ publicada: false, retirada: true });
		expect(listarPublicadas(db)).toEqual([]);
		expect(() => publicar(db, id, true)).toThrow(ErrorInvestigacion);
	});
});
