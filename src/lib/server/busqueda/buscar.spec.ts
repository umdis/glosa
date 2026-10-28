import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import { buscar } from './buscar';

function baseDePrueba() {
	const db = abrirBase(':memory:');
	registrarVideo(db, 'v1', 'Devocional', []);
	guardarFragmentos(db, 'v1', [
		{ inicioMs: 0, finMs: 15_000, texto: 'Hoy hablaremos de la tentación y de cómo vencerla.' },
		{ inicioMs: 15_000, finMs: 30_000, texto: 'La prueba de vuestra fe produce paciencia.' },
		{ inicioMs: 30_000, finMs: 45_000, texto: 'La crianza de los hijos pide constancia.' },
		{ inicioMs: 45_000, finMs: 60_000, texto: 'Después de tantos años, el fermento sigue.' },
		{ inicioMs: 60_000, finMs: 75_000, texto: 'Oramos por la tentación de un hermano enfermo.' }
	]);
	return db;
}

const textos = (resultados: ReturnType<typeof buscar>) => resultados.map((r) => r.texto);

describe('buscar', () => {
	it('encuentra otra forma de la misma palabra: «tentaciones» → «tentación»', () => {
		const resultados = buscar(baseDePrueba(), 'tentaciones');
		expect(resultados.map((r) => r.inicioMs).sort()).toEqual([0, 60_000]);
		expect(resultados.every((r) => r.via === 'raiz')).toBe(true);
	});

	it('ignora tildes y mayúsculas', () => {
		expect(buscar(baseDePrueba(), 'TENTACION')).toHaveLength(2);
	});

	it('resalta la palabra tal como se dijo, con su tilde', () => {
		const [primero] = buscar(baseDePrueba(), 'tentaciones', { limite: 1 });
		const [inicio, fin] = primero.marcas[0];
		expect(primero.texto.slice(inicio, fin)).toBe('tentación');
	});

	it('exige todas las palabras de la consulta', () => {
		expect(textos(buscar(baseDePrueba(), 'prueba paciencia'))).toEqual([
			'La prueba de vuestra fe produce paciencia.'
		]);
	});

	it('completa con trigramas lo que el stemmer no une («año» → «años»)', () => {
		const resultados = buscar(baseDePrueba(), 'año');
		expect(textos(resultados)).toEqual(['Después de tantos años, el fermento sigue.']);
		expect(resultados[0].via).toBe('trigrama');
	});

	it('una palabra corta no dispara los trigramas: «fe» no trae «fermento»', () => {
		expect(textos(buscar(baseDePrueba(), 'fe'))).toEqual([
			'La prueba de vuestra fe produce paciencia.'
		]);
	});

	it('limitación conocida: «criar» no encuentra «crianza» (raíces cri / crianz)', () => {
		// Lo cubre la reformulación del agente, no la búsqueda directa (tasks.md 3.2).
		expect(buscar(baseDePrueba(), 'criar')).toEqual([]);
		expect(textos(buscar(baseDePrueba(), 'crianza'))).toHaveLength(1);
	});

	it('no devuelve fragmentos pendientes de revisión ni ocultos', () => {
		const db = baseDePrueba();
		db.prepare(`UPDATE fragmentos SET visibilidad = 'pendiente' WHERE inicio_ms = 60000`).run();
		expect(buscar(db, 'tentación').map((r) => r.inicioMs)).toEqual([0]);
		db.prepare(`UPDATE fragmentos SET visibilidad = 'oculto' WHERE inicio_ms = 0`).run();
		expect(buscar(db, 'tentación')).toEqual([]);
	});

	it('una consulta sin palabras no devuelve nada', () => {
		expect(buscar(baseDePrueba(), ' ¿?! ')).toEqual([]);
	});
});
