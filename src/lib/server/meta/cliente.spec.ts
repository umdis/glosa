import { describe, expect, it, vi } from 'vitest';
import { ClienteMeta, ErrorMeta, type UsoMedido } from './cliente';
import { costoTokens, costoTranscripcion } from './precios';

const CLAVE = 'clave-de-prueba-que-no-debe-filtrarse';

function crearCliente(respuestas: Array<Response | Error>) {
	const usos: UsoMedido[] = [];
	const fetchFalso = vi.fn(async () => {
		const siguiente = respuestas.shift();
		if (!siguiente) throw new Error('No quedan respuestas simuladas');
		if (siguiente instanceof Error) throw siguiente;
		return siguiente;
	});
	const cliente = new ClienteMeta({
		apiKey: CLAVE,
		registroGasto: { registrar: (uso) => usos.push(uso) },
		fetch: fetchFalso as unknown as typeof fetch,
		esperar: async () => {}
	});
	return { cliente, fetchFalso, usos };
}

const json = (cuerpo: unknown, status = 200) =>
	new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

describe('ClienteMeta.responses', () => {
	it('autentica con Bearer y registra el uso con su costo', async () => {
		const { cliente, fetchFalso, usos } = crearCliente([
			json({
				output_text: 'ok',
				usage: {
					input_tokens: 2000,
					input_tokens_details: { cached_tokens: 1000 },
					output_tokens: 100
				}
			})
		]);
		await cliente.responses({ model: 'muse-spark-1.3', input: 'hola' }, 'prueba');

		const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.meta.ai/v1/responses');
		expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${CLAVE}`);
		expect(usos).toEqual([
			{
				modelo: 'muse-spark-1.3',
				operacion: 'prueba',
				tokensEntrada: 2000,
				tokensCache: 1000,
				tokensSalida: 100,
				segundosAudio: 0,
				costoUsd: costoTokens('muse-spark-1.3', 2000, 1000, 100)
			}
		]);
	});

	it('reintenta ante 503 y fallos de red, y termina bien', async () => {
		const { cliente, fetchFalso } = crearCliente([
			new Response('caído', { status: 503 }),
			new TypeError('fetch failed'),
			json({ usage: {} })
		]);
		await cliente.responses({ model: 'muse-spark-1.3', input: 'hola' });
		expect(fetchFalso).toHaveBeenCalledTimes(3);
	});

	it('no reintenta un error del cliente y no filtra la clave en el mensaje', async () => {
		const { cliente, fetchFalso } = crearCliente([
			new Response('{"error":"bad"}', { status: 400 })
		]);
		const error = await cliente.responses({ model: 'muse-spark-1.3', input: 'x' }).catch((e) => e);
		expect(error).toBeInstanceOf(ErrorMeta);
		expect(error.status).toBe(400);
		expect(String(error.message)).not.toContain(CLAVE);
		expect(fetchFalso).toHaveBeenCalledTimes(1);
	});

	it('se niega a usar el tier contributor', async () => {
		const { cliente, fetchFalso } = crearCliente([]);
		await expect(
			cliente.responses({ model: 'muse-spark-1.3-contributor', input: 'x' })
		).rejects.toThrow(/contributor/);
		expect(fetchFalso).not.toHaveBeenCalled();
	});

	it('falla con un mensaje claro si falta la clave', async () => {
		const cliente = new ClienteMeta({ apiKey: undefined, registroGasto: { registrar: () => {} } });
		await expect(cliente.responses({ model: 'muse-spark-1.3', input: 'x' })).rejects.toThrow(
			/MODEL_API_KEY/
		);
	});
});

describe('ClienteMeta.transcribir', () => {
	it('envía los ajustes y registra los segundos de audio', async () => {
		const { cliente, fetchFalso, usos } = crearCliente([
			json({
				transcript: 'hermanos',
				audioDurationMs: 30_900,
				turns: [{ turnId: 1, speaker: 'A', startMs: 100, endMs: 2000, transcript: 'hermanos' }]
			})
		]);
		const resultado = await cliente.transcribir(new Blob(['RIFF']), {
			idiomas: ['es'],
			palabrasClave: ['Santiago']
		});

		const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.meta.ai/v1/asr/transcribe');
		const ajustes = JSON.parse(await ((init.body as FormData).get('request') as Blob).text());
		expect(ajustes).toMatchObject({
			model: 'muse-voice-transcribe-1.0',
			audioEncoding: 'WAV',
			languageBias: ['es'],
			keywords: ['Santiago']
		});
		expect(resultado.turns).toHaveLength(1);
		expect(usos[0]).toMatchObject({ segundosAudio: 30, costoUsd: costoTranscripcion(30) });
	});
});

describe('precios', () => {
	it('cobra la transcripción por segundos enteros a US$0,18 la hora', () => {
		expect(costoTranscripcion(3600)).toBeCloseTo(0.18);
		expect(costoTranscripcion(59.9)).toBeCloseTo(costoTranscripcion(59));
	});

	it('rechaza un modelo sin precio conocido en vez de suponer cero', () => {
		expect(() => costoTokens('modelo-desconocido', 1, 0, 1)).toThrow();
	});
});
