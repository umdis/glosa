import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBase, type Base } from '../db/base';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import type { CuerpoChat, RespuestaChat } from '../meta/cliente';
import { anadirCita, bloquesDe, crearInvestigacion } from './datos';
import { leerBorrador, redactarSeccion } from './redactar';

let db: Base;
let f: number[];

beforeEach(() => {
	db = abrirBase(':memory:');
	registrarVideo(db, 'v1', 'Familia', []);
	guardarFragmentos(db, 'v1', [
		{
			inicioMs: 0,
			finMs: 9_000,
			texto: 'El perdón empieza en la casa, en la mesa de todos los días'
		},
		{
			inicioMs: 9_000,
			finMs: 18_000,
			texto: 'Los hijos aprenden más de lo que ven que de lo que oyen'
		},
		{
			inicioMs: 18_000,
			finMs: 27_000,
			texto: 'Oremos por la familia de nuestra congregación esta semana'
		}
	]);
	db.prepare(`UPDATE videos SET archivo_reproduccion = 'reproduccion.mp4'`).run();
	f = (db.prepare(`SELECT id FROM fragmentos ORDER BY orden`).all() as Array<{ id: number }>).map(
		(x) => x.id
	);
});

function metaQueResponde(contenido: unknown) {
	const llamadas: CuerpoChat[] = [];
	return {
		llamadas,
		chat: async (cuerpo: CuerpoChat): Promise<RespuestaChat> => {
			llamadas.push(cuerpo);
			return {
				choices: [
					{
						finish_reason: 'stop',
						message: { role: 'assistant', content: JSON.stringify(contenido) }
					}
				]
			};
		}
	};
}

describe('redactarSeccion', () => {
	it('inserta texto marcado como IA y solo las citas verificadas del cuaderno', async () => {
		const { id } = crearInvestigacion(db, 'Perdón en familia');
		anadirCita(db, id, f[0], '');
		anadirCita(db, id, f[1], '');
		const meta = metaQueResponde({
			bloques: [
				{ tipo: 'titulo', texto: 'La casa como escuela', citas: [] },
				{
					tipo: 'texto',
					texto: 'El perdón se aprende en lo cotidiano.',
					citas: [
						{ fragmento_id: f[0], frase: 'El perdón empieza en la casa' },
						// Fragmento real pero fuera del cuaderno: se descarta.
						{ fragmento_id: f[2], frase: 'Oremos por la familia de nuestra congregación' },
						// Inventada: se descarta.
						{ fragmento_id: f[1], frase: 'los padres siempre tienen la razón en todo' }
					]
				}
			]
		});

		const r = await redactarSeccion(
			db,
			meta,
			{ id, titulo: 'Perdón en familia' },
			'an introduction'
		);
		expect(r).toEqual({ bloques: 2, citas: 1, descartadas: 2 });

		const nuevos = bloquesDe(db, id).slice(2);
		expect(nuevos.map((b) => b.tipo)).toEqual(['titulo', 'texto', 'cita']);
		expect(nuevos.every((b) => b.origenIa)).toBe(true);
		const cita = nuevos[2];
		expect(cita.tipo === 'cita' && cita.cita?.fragmentoId).toBe(f[0]);

		// Al modelo solo le llegan los fragmentos del cuaderno.
		const enviado = JSON.stringify(meta.llamadas[0].messages);
		expect(enviado).toContain('Los hijos aprenden');
		expect(enviado).not.toContain('Oremos por la familia');
	});

	it('sin citas en el cuaderno no llama al modelo', async () => {
		const { id } = crearInvestigacion(db, 'Vacía');
		const meta = metaQueResponde({ bloques: [] });
		await expect(redactarSeccion(db, meta, { id, titulo: 'Vacía' }, '')).rejects.toThrow(
			'Add at least one quote'
		);
		expect(meta.llamadas).toHaveLength(0);
	});

	it('una cita del cuaderno que luego se oculta no se manda al modelo', async () => {
		const { id } = crearInvestigacion(db, 'Oculta');
		anadirCita(db, id, f[0], '');
		anadirCita(db, id, f[1], '');
		db.prepare(`UPDATE fragmentos SET visibilidad = 'oculto' WHERE id = ?`).run(f[1]);
		const meta = metaQueResponde({ bloques: [{ tipo: 'texto', texto: 'Algo.', citas: [] }] });
		await redactarSeccion(db, meta, { id, titulo: 'Oculta' }, '');
		expect(JSON.stringify(meta.llamadas[0].messages)).not.toContain('Los hijos aprenden');
	});

	it('si no queda nada usable, avisa y no inserta', async () => {
		const { id } = crearInvestigacion(db, 'Nada');
		anadirCita(db, id, f[0], '');
		const meta = metaQueResponde({ otra: 'cosa' });
		await expect(redactarSeccion(db, meta, { id, titulo: 'Nada' }, '')).rejects.toThrow(
			'usable draft'
		);
		expect(bloquesDe(db, id)).toHaveLength(1);
	});
});

describe('leerBorrador', () => {
	it('descarta lo mal formado', () => {
		expect(leerBorrador('no es json')).toEqual([]);
		expect(
			leerBorrador(
				JSON.stringify({
					bloques: [
						{ tipo: 'imagen', texto: 'x', citas: [] },
						{ tipo: 'texto', texto: '   ', citas: [] },
						{ tipo: 'texto', texto: 'Bien', citas: [{ fragmento_id: 'x', frase: 'y' }] }
					]
				})
			)
		).toEqual([{ tipo: 'texto', texto: 'Bien', citas: [] }]);
	});
});
