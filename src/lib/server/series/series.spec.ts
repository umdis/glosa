import { describe, expect, it } from 'vitest';
import { preguntar } from '../agente/agente';
import { ejecutarHerramienta, type FragmentoEvidencia } from '../agente/herramientas';
import { guardarRespuesta, respuestaGuardada } from '../agente/limites';
import { abrirBase } from '../db/base';
import { migraciones } from '../db/esquema';
import { buscar } from '../busqueda/buscar';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import type { CuerpoChat, RespuestaChat } from '../meta/cliente';
import { decidir } from '../revision/decisiones';
import { guardarFicha } from '../revision/resumen';
import {
	etiquetaPorSlug,
	etiquetasDeVideo,
	fusionarEtiquetas,
	listarEtiquetas,
	videosConEtiqueta
} from './etiquetas';
import {
	asignarVideos,
	crearSerie,
	decidirResumenSerie,
	listarSeries,
	proponerResumenSerie,
	resumenesPendientes,
	serieCompleta
} from './series';
import Database from 'better-sqlite3';

function preparar() {
	const db = abrirBase(':memory:');
	registrarVideo(db, 'familia1', 'La familia según Efesios', []);
	guardarFragmentos(db, 'familia1', [
		{
			inicioMs: 0,
			finMs: 15_000,
			texto: 'padres no provoquéis a ira a vuestros hijos sino criadlos'
		}
	]);
	registrarVideo(db, 'familia2', 'Criar con paciencia', []);
	guardarFragmentos(db, 'familia2', [
		{
			inicioMs: 0,
			finMs: 15_000,
			texto: 'la crianza de los hijos pide paciencia y perdón cada día'
		}
	]);
	registrarVideo(db, 'otro', 'Santiago 1', []);
	guardarFragmentos(db, 'otro', [
		{
			inicioMs: 0,
			finMs: 15_000,
			texto: 'la prueba de vuestra fe produce paciencia en los hijos de Dios'
		}
	]);
	const fragmento = (video: string) =>
		(db.prepare(`SELECT id FROM fragmentos WHERE video_id = ?`).get(video) as { id: number }).id;
	return { db, fragmento };
}

const texto = (contenido: string): RespuestaChat => ({
	choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: contenido } }],
	usage: { prompt_tokens: 100, completion_tokens: 10 }
});

function clienteGuionado(respuestas: Array<(cuerpo: CuerpoChat) => RespuestaChat>) {
	const recibidos: CuerpoChat[] = [];
	return {
		recibidos,
		chat: async (cuerpo: CuerpoChat) => {
			recibidos.push(structuredClone(cuerpo));
			const siguiente = respuestas.shift();
			if (!siguiente) throw new Error('El guion no tiene más respuestas');
			return siguiente(cuerpo);
		}
	};
}

const llamar = (nombre: string, argumentos: object): RespuestaChat => ({
	choices: [
		{
			finish_reason: 'tool_calls',
			message: {
				role: 'assistant',
				content: null,
				tool_calls: [
					{
						id: `c-${nombre}`,
						type: 'function',
						function: { name: nombre, arguments: JSON.stringify(argumentos) }
					}
				]
			}
		}
	],
	usage: { prompt_tokens: 100, completion_tokens: 10 }
});

describe('series', () => {
	it('crea series con id legible, sin repetir, y guarda los videos en orden', () => {
		const { db } = preparar();
		const serie = crearSerie(db, 'Familia', 'Prédicas sobre el hogar')!;
		expect(serie.id).toBe('familia');
		expect(crearSerie(db, 'familia')!.id).toBe('familia-2');
		expect(crearSerie(db, '   ')).toBeNull();

		asignarVideos(db, 'familia', ['familia2', 'familia1', 'no-existe']);
		expect(serieCompleta(db, 'familia')!.videos.map((v) => v.id)).toEqual(['familia2', 'familia1']);
		// Al público solo le llegan las series con videos.
		expect(listarSeries(db).map((s) => s.id)).toEqual(['familia']);
		expect(listarSeries(db, { conVacias: true })).toHaveLength(2);
	});

	it('el resumen compilado nace pendiente y solo se ve al aprobarlo', async () => {
		const { db } = preparar();
		crearSerie(db, 'Familia');
		asignarVideos(db, 'familia', ['familia1', 'familia2']);

		const sinFichas = clienteGuionado([]);
		expect(await proponerResumenSerie(db, sinFichas, 'familia')).toBeNull();

		guardarFicha(db, 'familia1', { resumen: 'Sobre la crianza en Efesios 6.', temas: ['familia'] });
		for (const p of db.prepare(`SELECT id FROM pendientes`).all() as Array<{ id: number }>) {
			decidir(db, p.id, 'aprobado', 'admin');
		}
		const cliente = clienteGuionado([() => texto('La serie trata de la crianza.')]);
		expect(await proponerResumenSerie(db, cliente, 'familia')).toBe(
			'La serie trata de la crianza.'
		);
		// Solo usó la ficha aprobada.
		expect(cliente.recibidos[0].messages.at(-1)!.content).toContain(
			'Sobre la crianza en Efesios 6.'
		);

		expect(serieCompleta(db, 'familia')!.resumen).toBeNull();
		const [pendiente] = resumenesPendientes(db);
		expect(decidirResumenSerie(db, pendiente.id, 'aprobado', 'admin')).toBe(true);
		expect(decidirResumenSerie(db, pendiente.id, 'oculto', 'admin')).toBe(false);
		expect(serieCompleta(db, 'familia')!.resumen).toBe('La serie trata de la crianza.');
	});
});

describe('preguntar dentro de una serie', () => {
	it('las herramientas no ven nada fuera del ámbito', () => {
		const { db, fragmento } = preparar();
		const ambito = new Set(['familia1', 'familia2']);
		const evidencia = new Map<number, FragmentoEvidencia>();

		const encontrados = JSON.parse(
			ejecutarHerramienta(db, 'buscar', { consulta: 'paciencia' }, evidencia, ambito)
		) as FragmentoEvidencia[];
		expect(encontrados.map((f) => f.video_id)).toEqual(['familia2']);

		const leer = JSON.parse(
			ejecutarHerramienta(
				db,
				'leer_fragmentos',
				{ fragmento_id: fragmento('otro') },
				evidencia,
				ambito
			)
		);
		expect(leer).toEqual({ error: 'Fragment not found' });

		const lista = JSON.parse(
			ejecutarHerramienta(db, 'listar_videos', {}, evidencia, ambito)
		) as Array<{
			video_id: string;
		}>;
		expect(lista.map((v) => v.video_id).sort()).toEqual(['familia1', 'familia2']);
		expect([...evidencia.values()].every((f) => ambito.has(f.video_id))).toBe(true);
	});

	it('rechaza una cita literal de un video fuera de la serie', async () => {
		const { db, fragmento } = preparar();
		const cliente = clienteGuionado([
			() => llamar('buscar', { consulta: 'paciencia' }),
			() => texto('Listo.'),
			() =>
				texto(
					JSON.stringify({
						sin_evidencia: false,
						idioma: 'es',
						afirmaciones: [
							{
								texto: 'La crianza pide paciencia.',
								citas: [
									{
										fragmento_id: fragmento('familia2'),
										frase: 'la crianza de los hijos pide paciencia'
									}
								]
							},
							{
								// El modelo cita un fragmento que no vio: es literal, pero está fuera.
								texto: 'La prueba produce paciencia.',
								citas: [
									{
										fragmento_id: fragmento('otro'),
										frase: 'la prueba de vuestra fe produce paciencia'
									}
								]
							}
						]
					})
				)
		]);
		const resultado = await preguntar(db, cliente, '¿Qué se dijo de la paciencia?', {
			ambito: ['familia1', 'familia2']
		});
		expect(resultado.afirmaciones.map((a) => a.respaldo)).toEqual(['respaldada', 'sin_respaldo']);
		const citas = resultado.afirmaciones.flatMap((a) => a.citas);
		expect(citas.every((c) => c.estado !== 'verificada' || c.videoId !== 'otro')).toBe(true);
	});

	it('la respuesta guardada de una serie no responde a la colección entera, ni al revés', () => {
		const { db, fragmento } = preparar();
		const resultado = {
			pregunta: 'paciencia',
			sinEvidencia: false,
			pasos: 1,
			busquedas: [],
			afirmaciones: [
				{
					texto: 'La prueba produce paciencia.',
					respaldo: 'respaldada' as const,
					citas: [
						{
							estado: 'verificada' as const,
							frase: 'la prueba de vuestra fe produce paciencia',
							fragmentoId: fragmento('otro'),
							videoId: 'otro',
							titulo: 'Santiago 1',
							inicioMs: 0,
							coincidencia: 1
						}
					]
				}
			]
		};
		guardarRespuesta(db, resultado);
		expect(respuestaGuardada(db, 'paciencia')).not.toBeNull();
		expect(respuestaGuardada(db, 'paciencia', { id: 'familia', videos: ['familia1'] })).toBeNull();

		// Guardada dentro de una serie que después perdió ese video: ya no vale.
		guardarRespuesta(db, resultado, 'familia');
		expect(respuestaGuardada(db, 'paciencia', { id: 'familia', videos: ['familia1'] })).toBeNull();
		expect(
			respuestaGuardada(db, 'paciencia', { id: 'familia', videos: ['familia1', 'otro'] })
		).not.toBeNull();
	});
});

describe('etiquetas', () => {
	it('aprobar los temas etiqueta el video; temas equivalentes caen en la misma etiqueta', () => {
		const { db } = preparar();
		guardarFicha(db, 'familia1', { resumen: 'r', temas: ['Perdón', 'Familia'] });
		guardarFicha(db, 'familia2', { resumen: 'r', temas: ['perdon', 'Paciencia'] });
		const temas = db.prepare(`SELECT id FROM pendientes WHERE tipo = 'temas'`).all() as Array<{
			id: number;
		}>;
		for (const t of temas) decidir(db, t.id, 'aprobado', 'admin');

		const perdon = etiquetaPorSlug(db, 'perdon')!;
		expect(videosConEtiqueta(db, perdon.id).sort()).toEqual(['familia1', 'familia2']);
		expect(listarEtiquetas(db).map((e) => e.slug)).toEqual(['familia', 'paciencia', 'perdon']);

		// Filtro de búsqueda por etiqueta: solo los videos que la llevan.
		const familia = etiquetaPorSlug(db, 'familia')!;
		expect(
			buscar(db, 'hijos', { videoIds: videosConEtiqueta(db, familia.id) }).map((r) => r.videoId)
		).toEqual(['familia1']);
		expect(buscar(db, 'hijos', { videoIds: [] })).toEqual([]);
	});

	it('fusionar reasigna los videos y el nombre absorbido no resucita', () => {
		const { db } = preparar();
		guardarFicha(db, 'familia1', { resumen: 'r', temas: ['Crianza'] });
		guardarFicha(db, 'familia2', { resumen: 'r', temas: ['Educar a los hijos'] });
		for (const t of db.prepare(`SELECT id FROM pendientes WHERE tipo = 'temas'`).all() as Array<{
			id: number;
		}>)
			decidir(db, t.id, 'aprobado', 'admin');

		const crianza = etiquetaPorSlug(db, 'crianza')!;
		const educar = etiquetaPorSlug(db, 'educar-a-los-hijos')!;
		expect(fusionarEtiquetas(db, educar.id, crianza.id)).toBe(true);
		expect(etiquetaPorSlug(db, 'educar-a-los-hijos')).toBeUndefined();
		expect(videosConEtiqueta(db, crianza.id).sort()).toEqual(['familia1', 'familia2']);

		// Se vuelve a proponer y aprobar el tema absorbido: va a la etiqueta que quedó.
		guardarFicha(db, 'familia2', { resumen: 'r2', temas: ['Educar a los hijos'] });
		const nuevo = db
			.prepare(`SELECT id FROM pendientes WHERE tipo = 'temas' AND estado = 'pendiente'`)
			.get() as { id: number };
		decidir(db, nuevo.id, 'aprobado', 'admin');
		expect(etiquetaPorSlug(db, 'educar-a-los-hijos')).toBeUndefined();
		expect(etiquetasDeVideo(db, 'familia2').map((e) => e.slug)).toEqual(['crianza']);
	});

	it('la migración convierte en etiquetas los temas ya aprobados', () => {
		const db = new Database(':memory:');
		db.pragma('foreign_keys = ON');
		for (const m of migraciones.slice(0, 5)) {
			if (typeof m === 'string') db.exec(m);
			else m(db);
		}
		db.prepare(
			`INSERT INTO videos (id, titulo, archivo_original) VALUES ('v', 'V', 'v.mp4')`
		).run();
		db.prepare(
			`INSERT INTO pendientes (tipo, video_id, contenido, estado, decidido_en)
			 VALUES ('temas', 'v', '["Fe", "Oración"]', 'aprobado', datetime('now')),
			        ('temas', 'v', '["No aprobado"]', 'pendiente', NULL)`
		).run();
		const sexta = migraciones[5];
		if (typeof sexta === 'string') db.exec(sexta);
		else sexta(db);
		expect(
			(db.prepare(`SELECT slug FROM etiquetas ORDER BY slug`).all() as Array<{ slug: string }>).map(
				(e) => e.slug
			)
		).toEqual(['fe', 'oracion']);
	});
});
