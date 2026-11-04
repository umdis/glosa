import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ResultadoAgente } from '../agente/agente';
import { abrirBase } from '../db/base';
import {
	AVISOS,
	PREGUNTAS_POR_DIA,
	atenderMensaje,
	contarPregunta,
	firmaValida,
	formatearRespuesta,
	leerMensajes,
	remitente,
	responderReto
} from './whatsapp';

const SECRETO = 'secreto-de-prueba';
const firmar = (cuerpo: string, secreto = SECRETO) =>
	`sha256=${createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;

describe('firma del webhook', () => {
	const cuerpo = '{"entry":[]}';
	it('acepta solo la firma del secreto de la app sobre el cuerpo exacto', () => {
		expect(firmaValida(cuerpo, firmar(cuerpo), SECRETO)).toBe(true);
		expect(firmaValida(cuerpo + ' ', firmar(cuerpo), SECRETO)).toBe(false);
		expect(firmaValida(cuerpo, firmar(cuerpo, 'otro'), SECRETO)).toBe(false);
	});
	it('rechaza sin cabecera, con formato raro o sin secreto configurado', () => {
		expect(firmaValida(cuerpo, null, SECRETO)).toBe(false);
		expect(firmaValida(cuerpo, 'sha256=abc', SECRETO)).toBe(false);
		expect(firmaValida(cuerpo, firmar(cuerpo).replace('sha256=', 'sha1='), SECRETO)).toBe(false);
		expect(firmaValida(cuerpo, firmar(cuerpo), undefined)).toBe(false);
	});
});

describe('reto de verificación', () => {
	const params = (token: string, modo = 'subscribe') =>
		new URLSearchParams({ 'hub.mode': modo, 'hub.verify_token': token, 'hub.challenge': '1234' });
	it('devuelve el reto solo con el token configurado', () => {
		expect(responderReto(params('bien'), 'bien')).toBe('1234');
		expect(responderReto(params('mal'), 'bien')).toBeNull();
		expect(responderReto(params('bien', 'otro'), 'bien')).toBeNull();
		expect(responderReto(params(''), undefined)).toBeNull();
	});
});

const evento = (mensajes: object[]) => ({
	object: 'whatsapp_business_account',
	entry: [{ changes: [{ value: { messaging_product: 'whatsapp', messages: mensajes } }] }]
});

describe('leerMensajes', () => {
	it('saca texto y tipo; ignora estados y basura', () => {
		expect(
			leerMensajes(
				evento([
					{ id: 'm1', from: '573000000000', type: 'text', text: { body: 'hola' } },
					{ id: 'm2', from: '573000000000', type: 'image', image: {} },
					{ from: 'sin-id', type: 'text' }
				])
			)
		).toEqual([
			{ id: 'm1', de: '573000000000', tipo: 'text', texto: 'hola' },
			{ id: 'm2', de: '573000000000', tipo: 'image' }
		]);
		expect(leerMensajes({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([]);
		expect(leerMensajes(null)).toEqual([]);
	});
});

const cita = (fragmentoId: number, frase: string) => ({
	estado: 'verificada' as const,
	frase,
	fragmentoId,
	videoId: 'v1',
	titulo: 'Criar hijos con valores',
	inicioMs: 750_000 + fragmentoId * 1000,
	coincidencia: 1
});

const resultado = (idioma = 'en'): ResultadoAgente => ({
	pregunta: 'What was said about raising children?',
	sinEvidencia: false,
	pasos: 2,
	busquedas: [],
	idioma,
	afirmaciones: [
		{
			texto: 'Raising children means sowing values.',
			respaldo: 'respaldada',
			citas: [
				{ ...cita(1, 'criar es sembrar valores'), traduccion: 'raising is sowing values' },
				cita(2, 'los valores se viven en casa')
			]
		},
		{
			texto: 'Parents must live the values.',
			respaldo: 'respaldada',
			citas: [cita(3, 'los padres deben vivir'), cita(4, 'la cuarta cita no cabe')]
		},
		{
			texto: 'This claim had no support.',
			respaldo: 'sin_respaldo',
			citas: [
				{
					estado: 'no_verificada',
					frase: 'inventada',
					fragmentoId: 9,
					motivo: 'no_encontrada',
					coincidencia: 0
				}
			]
		}
	]
});

describe('formatearRespuesta', () => {
	it('afirmaciones respaldadas y hasta tres citas con minuto y enlace al momento', () => {
		const texto = formatearRespuesta(resultado(), 'https://glosa.umdis.site');
		expect(texto).toContain('Raising children means sowing values. Parents must live the values.');
		expect(texto).not.toContain('This claim had no support');
		expect(texto.match(/▶/g)).toHaveLength(3);
		expect(texto).not.toContain('la cuarta cita no cabe');
		expect(texto).toContain('▶ 12:31 — Criar hijos con valores');
		expect(texto).toContain('«criar es sembrar valores»\n(raising is sowing values)');
		expect(texto).toContain('https://glosa.umdis.site/videos/v1?t=751#f-1');
		expect(texto).toContain('Every quote was checked');
	});
	it('sin evidencia lo dice, en el idioma de la pregunta', () => {
		const sin = { ...resultado('es'), sinEvidencia: true, afirmaciones: [] };
		expect(formatearRespuesta(sin, 'https://x')).toContain('Los videos no hablan de esto');
	});
});

describe('límite por número', () => {
	it('cuenta por remitente y día; el remitente es un HMAC, no el número', () => {
		const db = abrirBase(':memory:');
		const id = remitente('573000000000', SECRETO);
		expect(id).toMatch(/^[0-9a-f]{64}$/);
		expect(id).not.toContain('573000000000');
		for (let i = 0; i < PREGUNTAS_POR_DIA; i++) expect(contarPregunta(db, id)).toBe(true);
		expect(contarPregunta(db, id)).toBe(false);
		expect(contarPregunta(db, remitente('573111111111', SECRETO))).toBe(true);
		const filas = db.prepare(`SELECT * FROM whatsapp_uso`).all() as Array<Record<string, unknown>>;
		expect(JSON.stringify(filas)).not.toContain('573');
	});
});

describe('atenderMensaje', () => {
	function preparar(opciones: { tope?: boolean } = {}) {
		const db = abrirBase(':memory:');
		const enviados: Array<{ url: string; cuerpo: { to: string; text: { body: string } } }> = [];
		const preguntas: Array<{ texto: string; visitante: string }> = [];
		const deps = {
			db,
			secreto: SECRETO,
			base: 'https://glosa.umdis.site',
			topeAlcanzado: () => opciones.tope ?? false,
			envio: {
				token: 't',
				idNumero: '123',
				fetch: (async (url: string, init: RequestInit) => {
					enviados.push({ url, cuerpo: JSON.parse(String(init.body)) });
					return new Response('{}', { status: 200 });
				}) as unknown as typeof fetch
			},
			preguntar: async (texto: string, visitante: string) => {
				preguntas.push({ texto, visitante });
				return { ok: true as const, resultado: resultado() };
			}
		};
		return { deps, enviados, preguntas };
	}
	let n = 0;
	const msj = (extra: object = {}) => ({
		id: `wamid.${++n}`,
		de: '573000000000',
		tipo: 'text',
		texto: 'What was said about raising children?',
		...extra
	});

	it('pregunta al agente y responde una sola vez al remitente', async () => {
		const { deps, enviados, preguntas } = preparar();
		const m = msj();
		await atenderMensaje(deps, m);
		await atenderMensaje(deps, m); // Meta reintenta el mismo evento
		expect(preguntas).toHaveLength(1);
		expect(preguntas[0].visitante).toMatch(/^wa:[0-9a-f]{64}$/);
		expect(enviados).toHaveLength(1);
		expect(enviados[0].url).toBe('https://graph.facebook.com/v21.0/123/messages');
		expect(enviados[0].cuerpo.to).toBe('573000000000');
		expect(enviados[0].cuerpo.text.body).toContain('▶');
	});

	it('un audio o una imagen reciben el aviso y no llegan al agente', async () => {
		const { deps, enviados, preguntas } = preparar();
		await atenderMensaje(deps, msj({ tipo: 'audio', texto: undefined }));
		expect(preguntas).toHaveLength(0);
		expect(enviados[0].cuerpo.text.body).toBe(AVISOS.soloTexto);
	});

	it('con el tope de gasto o el límite del número, aviso y sin agente', async () => {
		const tope = preparar({ tope: true });
		await atenderMensaje(tope.deps, msj());
		expect(tope.preguntas).toHaveLength(0);
		expect(tope.enviados[0].cuerpo.text.body).toBe(AVISOS.tope);

		const limite = preparar();
		const id = remitente('573000000000', SECRETO);
		for (let i = 0; i < PREGUNTAS_POR_DIA; i++) contarPregunta(limite.deps.db, id);
		await atenderMensaje(limite.deps, msj());
		expect(limite.preguntas).toHaveLength(0);
		expect(limite.enviados[0].cuerpo.text.body).toBe(AVISOS.limite);
	});
});
