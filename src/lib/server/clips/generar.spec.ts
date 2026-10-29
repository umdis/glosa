import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import { ColaLlena, argumentosClip, crearCola, pedidoClip, rutaEnFiltro } from './generar';

describe('argumentos de ffmpeg', () => {
	it('escapa las rutas de Windows dentro del filtro', () => {
		expect(rutaEnFiltro('D:\\datos\\clip.ass')).toBe("'D\\:/datos/clip.ass'");
		expect(rutaEnFiltro("/data/o'brien.ass")).toBe("'/data/o'\\''brien.ass'");
	});

	it('con imagen: fondo difuminado, video encima y subtítulos; sin imagen: color liso', () => {
		const base = {
			entrada: '/data/medios/v1/reproduccion.mp4',
			inicioMs: 30_000,
			duracionMs: 30_000,
			subtitulos: '/data/medios/v1/clips/c.ass',
			fuentes: '/app/fuentes',
			salida: '/data/medios/v1/clips/c.mp4'
		};
		const con = argumentosClip({ ...base, conImagen: true });
		expect(con.slice(3, 9)).toEqual(['-ss', '30.000', '-t', '30.000', '-i', base.entrada]);
		const filtro = con[con.indexOf('-filter_complex') + 1];
		expect(filtro).toContain('gblur');
		expect(filtro).toContain('overlay');
		expect(filtro).toContain("ass='/data/medios/v1/clips/c.ass':fontsdir='/app/fuentes'");

		const sin = argumentosClip({ ...base, conImagen: false });
		const filtroSin = sin[sin.indexOf('-filter_complex') + 1];
		expect(filtroSin.startsWith('[1:v]ass=')).toBe(true);
		expect(filtroSin).not.toContain('[0:v]');
		expect(sin).toContain('lavfi');
	});
});

describe('pedidoClip', () => {
	it('solo para fragmentos visibles de videos publicados, con nombre de caché por ventana', () => {
		const db = abrirBase(':memory:');
		registrarVideo(db, 'v1', 'Familia', []);
		guardarFragmentos(
			db,
			'v1',
			Array.from({ length: 6 }, (_, i) => ({
				inicioMs: i * 10_000,
				finMs: (i + 1) * 10_000,
				texto: `parte ${i}`
			}))
		);
		const ids = (
			db.prepare(`SELECT id FROM fragmentos ORDER BY orden`).all() as { id: number }[]
		).map((f) => f.id);
		expect(pedidoClip(db, ids[1], true)).toBeNull(); // video sin publicar

		db.prepare(`UPDATE videos SET archivo_reproduccion = 'reproduccion.mp4'`).run();
		const p = pedidoClip(db, ids[1], true)!;
		expect(p.archivo).toBe(`${ids[1]}-10000-40000-v.mp4`);
		expect(pedidoClip(db, ids[1], false)!.archivo).toBe(`${ids[1]}-10000-40000-c.mp4`);

		// Ocultar lo que seguía cambia la ventana y, con ella, el archivo: el viejo no se sirve.
		db.prepare(`UPDATE fragmentos SET visibilidad = 'oculto' WHERE id = ?`).run(ids[3]);
		expect(pedidoClip(db, ids[1], true)!.archivo).toBe(`${ids[1]}-0-30000-v.mp4`);
		db.prepare(`UPDATE fragmentos SET visibilidad = 'oculto' WHERE id = ?`).run(ids[1]);
		expect(pedidoClip(db, ids[1], true)).toBeNull();
	});
});

describe('crearCola', () => {
	it('procesa de a uno, deduplica y rechaza cuando está llena', async () => {
		const cola = crearCola(2);
		const orden: string[] = [];
		let soltar: () => void = () => {};
		const primero = new Promise<void>((r) => (soltar = r));
		const a = cola.encolar('a', async () => {
			orden.push('a-empieza');
			await primero;
			orden.push('a-termina');
			return 'A';
		});
		const aOtraVez = cola.encolar('a', async () => 'no debería correr');
		const b = cola.encolar('b', async () => {
			orden.push('b');
			return 'B';
		});
		await expect(cola.encolar('c', async () => 'C')).rejects.toBeInstanceOf(ColaLlena);
		soltar();
		expect(await a).toBe('A');
		expect(await aOtraVez).toBe('A');
		expect(await b).toBe('B');
		expect(orden).toEqual(['a-empieza', 'a-termina', 'b']);
		expect(cola.esperando).toBe(0);
	});

	it('un trabajo que falla no bloquea al siguiente', async () => {
		const cola = crearCola(3);
		const malo = cola.encolar('x', async () => {
			throw new Error('ffmpeg');
		});
		const bueno = cola.encolar('y', async () => 'Y');
		await expect(malo).rejects.toThrow('ffmpeg');
		expect(await bueno).toBe('Y');
	});
});
