import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import { guardarFragmentos, registrarVideo } from '../ingesta/pipeline';
import type { CuerpoChat, RespuestaChat } from '../meta/cliente';
import { leerRespuesta, preguntar } from './agente';

function preparar() {
	const db = abrirBase(':memory:');
	registrarVideo(db, 'v1', 'Devocional', []);
	guardarFragmentos(db, 'v1', [
		{
			inicioMs: 383_000,
			finMs: 399_000,
			texto: 'hermanos míos tened por sumo gozo cuando os halléis en diversas pruebas'
		},
		{
			inicioMs: 402_000,
			finMs: 419_000,
			texto:
				'que la prueba de vuestra fe produce paciencia, mas tenga la paciencia su obra completa'
		},
		{ inicioMs: 2_000_000, finMs: 2_015_000, texto: 'oramos por la salud del hermano Pedro' }
	]);
	db.prepare(`UPDATE fragmentos SET visibilidad = 'pendiente' WHERE orden = 2`).run();
	const id = (orden: number) =>
		(db.prepare(`SELECT id FROM fragmentos WHERE orden = ?`).get(orden) as { id: number }).id;
	return { db, id };
}

/** Cliente simulado: devuelve las respuestas en orden y guarda lo que recibió. */
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
	usage: { prompt_tokens: 1000, completion_tokens: 50 }
});

const texto = (contenido: string): RespuestaChat => ({
	choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: contenido } }],
	usage: { prompt_tokens: 1000, completion_tokens: 50 }
});

describe('preguntar', () => {
	it('investiga con herramientas, responde con la evidencia y verifica cada cita', async () => {
		const { db, id } = preparar();
		const cliente = clienteGuionado([
			() => llamar('buscar', { consulta: 'paciencia' }),
			() => texto('Encontré el pasaje.'),
			() =>
				texto(
					JSON.stringify({
						sin_evidencia: false,
						afirmaciones: [
							{
								texto: 'La prueba de la fe produce paciencia.',
								citas: [
									{ fragmento_id: id(1), frase: 'la prueba de vuestra fe produce paciencia' },
									{ fragmento_id: id(1), frase: 'la paciencia todo lo alcanza siempre' }
								]
							}
						]
					})
				)
		]);

		const resultado = await preguntar(db, cliente, '¿Qué produce la prueba de la fe?');

		expect(resultado.busquedas).toEqual(['paciencia']);
		expect(resultado.afirmaciones[0].respaldo).toBe('respaldada');
		expect(resultado.afirmaciones[0].citas.map((c) => c.estado)).toEqual([
			'verificada',
			'no_verificada'
		]);
		// La herramienta devolvió el resultado de la búsqueda al modelo como mensaje `tool`.
		const segundaLlamada = cliente.recibidos[1].messages;
		expect(segundaLlamada.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c-buscar' });
		// La fase de respuesta pidió salida estructurada y no ofreció herramientas.
		expect(cliente.recibidos[2].response_format).toBeDefined();
		expect(cliente.recibidos[2].tools).toBeUndefined();
	});

	it('la traza son exactamente las herramientas ejecutadas, con lo que devolvieron', async () => {
		const { db, id } = preparar();
		const cliente = clienteGuionado([
			() => llamar('buscar', { consulta: 'paciencia' }),
			() => llamar('buscar', { consulta: 'astronomía' }),
			() => llamar('leer_fragmentos', { fragmento_id: id(1), alrededor: 1 }),
			() => texto('Listo.'),
			() =>
				texto(
					JSON.stringify({
						sin_evidencia: false,
						afirmaciones: [
							{
								texto: 'La prueba produce paciencia.',
								citas: [
									{ fragmento_id: id(1), frase: 'la prueba de vuestra fe produce paciencia' },
									{ fragmento_id: id(1), frase: 'una frase que nunca se dijo en el video' }
								]
							}
						]
					})
				)
		]);
		const pasos: unknown[] = [];

		await preguntar(db, cliente, '¿Qué produce la prueba?', { alPaso: (p) => pasos.push(p) });

		expect(pasos).toEqual([
			{ tipo: 'herramienta', herramienta: 'buscar', detalle: 'paciencia', resultados: 1 },
			{ tipo: 'herramienta', herramienta: 'buscar', detalle: 'astronomía', resultados: 0 },
			// Lee el fragmento y su vecino visible; el pendiente de revisión no cuenta.
			{
				tipo: 'herramienta',
				herramienta: 'leer_fragmentos',
				detalle: 'Devocional',
				resultados: 2
			},
			{ tipo: 'redactar', fragmentos: 2 },
			{ tipo: 'verificar', citas: 2, verificadas: 1 }
		]);
	});

	it('pregunta en inglés: traduce solo las citas verificadas, y antes de anunciar la verificación', async () => {
		const { db, id } = preparar();
		const cliente = clienteGuionado([
			() => llamar('buscar', { consulta: 'paciencia' }),
			() => texto('Listo.'),
			() =>
				texto(
					JSON.stringify({
						sin_evidencia: false,
						idioma: 'en',
						afirmaciones: [
							{
								texto: 'Trials produce patience.',
								citas: [
									{ fragmento_id: id(1), frase: 'la prueba de vuestra fe produce paciencia' },
									{ fragmento_id: id(1), frase: 'una frase que nunca se dijo en el video' }
								]
							}
						]
					})
				),
			(cuerpo) => {
				// Al traductor solo le llega la cita verificada.
				expect(String(cuerpo.messages.at(-1)?.content)).toBe(
					'1. la prueba de vuestra fe produce paciencia'
				);
				return texto(
					JSON.stringify({
						traducciones: [{ n: 1, texto: 'the trying of your faith produces patience' }]
					})
				);
			}
		]);
		const pasos: Array<{ tipo: string }> = [];

		const resultado = await preguntar(db, cliente, 'What produces patience?', {
			alPaso: (p) => pasos.push(p)
		});

		expect(resultado.idioma).toBe('en');
		const [verificada, falsa] = resultado.afirmaciones[0].citas;
		expect(verificada).toMatchObject({
			estado: 'verificada',
			frase: 'la prueba de vuestra fe produce paciencia',
			traduccion: 'the trying of your faith produces patience'
		});
		expect(falsa.estado).toBe('no_verificada');
		expect('traduccion' in falsa).toBe(false);
		expect(pasos.map((p) => p.tipo).slice(-3)).toEqual(['redactar', 'traducir', 'verificar']);
	});

	it('si la traducción falla, la respuesta llega igual sin traducciones', async () => {
		const { db, id } = preparar();
		const cliente = clienteGuionado([
			() => llamar('buscar', { consulta: 'paciencia' }),
			() => texto('Listo.'),
			() =>
				texto(
					JSON.stringify({
						sin_evidencia: false,
						idioma: 'en',
						afirmaciones: [
							{
								texto: 'Trials produce patience.',
								citas: [{ fragmento_id: id(1), frase: 'la prueba de vuestra fe produce paciencia' }]
							}
						]
					})
				),
			() => {
				throw new Error('503');
			}
		]);
		const resultado = await preguntar(db, cliente, 'What produces patience?');
		expect(resultado.afirmaciones[0].citas[0]).toMatchObject({ estado: 'verificada' });
		expect(resultado.afirmaciones[0].citas[0]).not.toHaveProperty('traduccion', expect.anything());
	});

	it('sin evidencia no inventa: no llega a la fase de respuesta', async () => {
		const { db } = preparar();
		const cliente = clienteGuionado([
			() => llamar('buscar', { consulta: 'astronomía' }),
			() => texto('La colección no habla de eso.')
		]);
		const resultado = await preguntar(db, cliente, '¿Qué dijo sobre astronomía?');
		expect(resultado).toMatchObject({ sinEvidencia: true, afirmaciones: [] });
		expect(cliente.recibidos).toHaveLength(2);
	});

	it('las herramientas no ven fragmentos pendientes de revisión', async () => {
		const { db } = preparar();
		const cliente = clienteGuionado([
			() => llamar('buscar', { consulta: 'salud hermano Pedro' }),
			() => texto('Nada.')
		]);
		await preguntar(db, cliente, '¿Por quién oraron?');
		const respuestaHerramienta = cliente.recibidos[1].messages.at(-1);
		expect(JSON.stringify(respuestaHerramienta)).not.toContain('Pedro"');
		expect(JSON.stringify(respuestaHerramienta)).toContain('sin_resultados');
	});

	it('se detiene en el máximo de pasos', async () => {
		const { db } = preparar();
		const cliente = clienteGuionado(
			Array.from({ length: 10 }, () => () => llamar('buscar', { consulta: 'nada que exista' }))
		);
		const resultado = await preguntar(db, cliente, 'x', { maximoPasos: 3 });
		expect(resultado.pasos).toBe(3);
		expect(cliente.recibidos).toHaveLength(3);
	});
});

describe('leerRespuesta', () => {
	it('descarta citas mal formadas y tolera JSON roto', () => {
		expect(
			leerRespuesta(
				JSON.stringify({
					sin_evidencia: false,
					afirmaciones: [{ texto: 'a', citas: [{ fragmento_id: '7', frase: 'x' }, { frase: 'y' }] }]
				})
			).afirmaciones[0].citas
		).toEqual([]);
		expect(leerRespuesta('no es json')).toEqual({ sinEvidencia: true, afirmaciones: [] });
	});
});
