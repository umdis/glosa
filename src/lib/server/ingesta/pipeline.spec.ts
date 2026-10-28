import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import { textoARaices } from '../texto/raices';
import {
	guardarFragmentos,
	procesarVideo,
	recuperarInterrumpidos,
	registrarVideo,
	type DependenciasIngesta,
	type Paso
} from './pipeline';

function preparar(pasos: Paso[]) {
	const db = abrirBase(':memory:');
	const deps: DependenciasIngesta = {
		db,
		meta: { transcribir: async () => ({ transcript: '', turns: [], audioDurationMs: 0 }) },
		rutas: { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
		carpetaMedios: mkdtempSync(join(tmpdir(), 'glosa-'))
	};
	registrarVideo(db, 'v1', 'Prédica', pasos);
	const estado = () => {
		const video = db.prepare(`SELECT estado FROM videos WHERE id = 'v1'`).get() as {
			estado: string;
		};
		const pasosDb = db
			.prepare(`SELECT paso, estado, error FROM video_pasos WHERE video_id = 'v1' ORDER BY rowid`)
			.all();
		return { video: video.estado, pasos: pasosDb };
	};
	return { db, deps, estado };
}

const paso = (
	nombre: string,
	requiere: string[],
	ejecutar: Paso['ejecutar'] = async () => {}
): Paso => ({
	nombre,
	requiere,
	ejecutar
});

describe('procesarVideo', () => {
	it('deja el video listo cuando todos los pasos terminan', async () => {
		const pasos = [paso('a', []), paso('b', ['a'])];
		const { deps, estado } = preparar(pasos);
		await procesarVideo(deps, 'v1', pasos);
		expect(estado()).toEqual({
			video: 'listo',
			pasos: [
				{ paso: 'a', estado: 'hecho', error: null },
				{ paso: 'b', estado: 'hecho', error: null }
			]
		});
	});

	it('conserva lo hecho cuando falla un paso independiente y marca el error', async () => {
		const pasos = [
			paso('transcribir', []),
			paso('pantalla', ['transcribir'], async () => {
				throw new Error('Meta respondió 503');
			}),
			paso('pasajes', ['transcribir'])
		];
		const { deps, estado } = preparar(pasos);
		await procesarVideo(deps, 'v1', pasos);
		expect(estado()).toEqual({
			video: 'con_errores',
			pasos: [
				{ paso: 'transcribir', estado: 'hecho', error: null },
				{ paso: 'pantalla', estado: 'fallido', error: 'Meta respondió 503' },
				{ paso: 'pasajes', estado: 'hecho', error: null }
			]
		});
	});

	it('deja pendientes los pasos que dependen del que falló', async () => {
		const pasos = [
			paso('normalizar', [], async () => {
				throw new Error('ffmpeg falló');
			}),
			paso('transcribir', ['normalizar'])
		];
		const { deps, estado } = preparar(pasos);
		await procesarVideo(deps, 'v1', pasos);
		expect(estado().pasos).toEqual([
			{ paso: 'normalizar', estado: 'fallido', error: 'ffmpeg falló' },
			{ paso: 'transcribir', estado: 'pendiente', error: null }
		]);
	});

	it('al reintentar ejecuta solo lo que no está hecho', async () => {
		const llamadas: string[] = [];
		let fallar = true;
		const pasos = [
			paso('a', [], async () => void llamadas.push('a')),
			paso('b', ['a'], async () => {
				llamadas.push('b');
				if (fallar) throw new Error('falla una vez');
			})
		];
		const { deps, estado } = preparar(pasos);
		await procesarVideo(deps, 'v1', pasos);
		fallar = false;
		await procesarVideo(deps, 'v1', pasos);
		expect(llamadas).toEqual(['a', 'b', 'b']);
		expect(estado().video).toBe('listo');
	});
});

describe('recuperarInterrumpidos', () => {
	it('marca como fallido lo que quedó en curso al reiniciar', () => {
		const { db, estado } = preparar([paso('a', [])]);
		db.prepare(`UPDATE video_pasos SET estado = 'en_curso'`).run();
		recuperarInterrumpidos(db);
		expect(estado()).toEqual({
			video: 'con_errores',
			pasos: [{ paso: 'a', estado: 'fallido', error: 'Interrumpido por un reinicio del servidor' }]
		});
	});
});

describe('guardarFragmentos', () => {
	it('reemplaza los fragmentos sin duplicarlos y los deja buscables por su raíz', () => {
		const { db } = preparar([]);
		const fragmentos = [
			{ inicioMs: 383_000, finMs: 400_000, texto: 'Hermanos míos, tened por sumo gozo' },
			{ inicioMs: 400_000, finMs: 418_000, texto: 'cuando os halléis en diversas pruebas' }
		];
		guardarFragmentos(db, 'v1', fragmentos);
		guardarFragmentos(db, 'v1', fragmentos);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM fragmentos`).get()).toEqual({ n: 2 });
		expect(
			db
				.prepare(
					`SELECT f.inicio_ms AS inicio FROM fragmentos_raices r
					 JOIN fragmentos f ON f.id = r.rowid WHERE fragmentos_raices MATCH ?`
				)
				.all(textoARaices('prueba'))
		).toEqual([{ inicio: 400_000 }]);
	});
});
