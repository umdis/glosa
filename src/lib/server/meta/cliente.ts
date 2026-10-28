import { costoTokens, costoTranscripcion } from './precios';

const BASE_URL = 'https://api.meta.ai/v1';
export const MODELO_RAZONAMIENTO = 'muse-spark-1.3';
export const MODELO_TRANSCRIPCION = 'muse-voice-transcribe-1.0';

/** Uso de una llamada, listo para guardar en la tabla `gasto`. */
export interface UsoMedido {
	modelo: string;
	operacion: string;
	tokensEntrada: number;
	tokensCache: number;
	tokensSalida: number;
	segundosAudio: number;
	costoUsd: number;
}

export interface RegistroGasto {
	registrar(uso: UsoMedido): void;
}

export interface OpcionesCliente {
	apiKey: string | undefined;
	registroGasto: RegistroGasto;
	baseUrl?: string;
	fetch?: typeof fetch;
	/** Reintentos ante 429, 5xx o fallos de red. */
	reintentos?: number;
	timeoutMs?: number;
	/** Espera antes de reintentar; se puede sustituir en pruebas. */
	esperar?: (ms: number) => Promise<void>;
}

export interface TurnoTranscripcion {
	turnId?: string | number;
	speaker?: string;
	startMs: number;
	endMs: number;
	transcript: string;
}

export interface ResultadoTranscripcion {
	transcript: string;
	turns: TurnoTranscripcion[];
	audioDurationMs: number;
}

export interface OpcionesTranscripcion {
	idiomas?: string[];
	palabrasClave?: string[];
	modo?: 'PUSH_TO_TALK' | 'ENDPOINTING' | 'DIARIZATION';
}

/** Error de la API. Nunca incluye la clave; el cuerpo se recorta. */
export class ErrorMeta extends Error {
	constructor(
		readonly status: number,
		readonly cuerpo: string,
		readonly operacion: string
	) {
		super(`Meta Model API respondió ${status} en ${operacion}: ${cuerpo.slice(0, 300)}`);
		this.name = 'ErrorMeta';
	}
}

interface UsoResponses {
	input_tokens?: number;
	input_tokens_details?: { cached_tokens?: number };
	output_tokens?: number;
}

export class ClienteMeta {
	private readonly apiKey: string | undefined;
	private readonly registroGasto: RegistroGasto;
	private readonly baseUrl: string;
	private readonly fetch: typeof fetch;
	private readonly reintentos: number;
	private readonly timeoutMs: number;
	private readonly esperar: (ms: number) => Promise<void>;

	constructor(opciones: OpcionesCliente) {
		this.apiKey = opciones.apiKey;
		this.registroGasto = opciones.registroGasto;
		this.baseUrl = opciones.baseUrl ?? BASE_URL;
		this.fetch = opciones.fetch ?? globalThis.fetch;
		this.reintentos = opciones.reintentos ?? 3;
		this.timeoutMs = opciones.timeoutMs ?? 300_000;
		this.esperar = opciones.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
	}

	/** Llama a la Responses API y registra el uso de tokens. */
	async responses<T = Record<string, unknown>>(
		cuerpo: { model: string } & Record<string, unknown>,
		operacion = 'responses'
	): Promise<T & { usage?: UsoResponses }> {
		exigirTierStandard(cuerpo.model);
		const respuesta = await this.solicitar(operacion, '/responses', () => ({
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(cuerpo)
		}));
		const datos = (await respuesta.json()) as T & { usage?: UsoResponses };
		const uso = datos.usage ?? {};
		const entrada = uso.input_tokens ?? 0;
		const cache = uso.input_tokens_details?.cached_tokens ?? 0;
		const salida = uso.output_tokens ?? 0;
		this.registroGasto.registrar({
			modelo: cuerpo.model,
			operacion,
			tokensEntrada: entrada,
			tokensCache: cache,
			tokensSalida: salida,
			segundosAudio: 0,
			costoUsd: costoTokens(cuerpo.model, entrada, cache, salida)
		});
		return datos;
	}

	/** Sube un archivo a la Files API con caducidad. Devuelve su id. */
	async subirArchivo(archivo: Blob, nombre: string, caducaEnSegundos = 86_400): Promise<string> {
		const respuesta = await this.solicitar('subir_archivo', '/files', () => {
			const formulario = new FormData();
			formulario.append('file', archivo, nombre);
			formulario.append('purpose', 'user_data');
			formulario.append('expires_after[anchor]', 'created_at');
			formulario.append('expires_after[seconds]', String(caducaEnSegundos));
			return { method: 'POST', body: formulario };
		});
		const datos = (await respuesta.json()) as { id: string };
		return datos.id;
	}

	async borrarArchivo(id: string): Promise<void> {
		await this.solicitar('borrar_archivo', `/files/${encodeURIComponent(id)}`, () => ({
			method: 'DELETE'
		}));
	}

	/** Transcribe un WAV mono de 16 bits (máx. 10 min o 32 MB) y registra los segundos de audio. */
	async transcribir(
		wav: Blob,
		opciones: OpcionesTranscripcion = {}
	): Promise<ResultadoTranscripcion> {
		const ajustes = {
			mode: opciones.modo ?? 'DIARIZATION',
			model: MODELO_TRANSCRIPCION,
			audioEncoding: 'WAV',
			...(opciones.idiomas?.length ? { languageBias: opciones.idiomas } : {}),
			...(opciones.palabrasClave?.length ? { keywords: opciones.palabrasClave } : {})
		};
		const respuesta = await this.solicitar('transcribir', '/asr/transcribe', () => {
			const formulario = new FormData();
			formulario.append(
				'request',
				new Blob([JSON.stringify(ajustes)], { type: 'application/json' })
			);
			formulario.append('audio', wav, 'audio.wav');
			return { method: 'POST', headers: { Accept: 'application/json' }, body: formulario };
		});
		const datos = (await respuesta.json()) as ResultadoTranscripcion;
		const segundos = Math.floor((datos.audioDurationMs ?? 0) / 1000);
		this.registroGasto.registrar({
			modelo: MODELO_TRANSCRIPCION,
			operacion: 'transcribir',
			tokensEntrada: 0,
			tokensCache: 0,
			tokensSalida: 0,
			segundosAudio: segundos,
			costoUsd: costoTranscripcion(segundos)
		});
		return { ...datos, turns: datos.turns ?? [] };
	}

	/**
	 * Hace la petición con autenticación, timeout y reintentos con espera exponencial.
	 * `crearInit` se llama en cada intento porque un FormData no se puede reenviar dos veces.
	 */
	private async solicitar(
		operacion: string,
		ruta: string,
		crearInit: () => RequestInit
	): Promise<Response> {
		if (!this.apiKey) throw new Error('Falta MODEL_API_KEY para llamar a la Meta Model API');
		let ultimoError: unknown;
		for (let intento = 0; intento <= this.reintentos; intento++) {
			if (intento > 0) await this.esperar(esperaConVariacion(intento));
			const init = crearInit();
			let respuesta: Response;
			try {
				respuesta = await this.fetch(`${this.baseUrl}${ruta}`, {
					...init,
					headers: { ...init.headers, Authorization: `Bearer ${this.apiKey}` },
					signal: AbortSignal.timeout(this.timeoutMs)
				});
			} catch (error) {
				ultimoError = error;
				continue;
			}
			if (respuesta.ok) return respuesta;
			const cuerpo = await respuesta.text();
			ultimoError = new ErrorMeta(respuesta.status, cuerpo, operacion);
			// Los errores del cliente no mejoran reintentando; los 429 y 5xx sí.
			if (respuesta.status !== 429 && respuesta.status < 500) break;
		}
		throw ultimoError;
	}
}

/** El tier contributor entrena con los datos enviados: Glosa no lo usa nunca (design.md D9). */
function exigirTierStandard(modelo: string): void {
	if (modelo.includes('contributor')) {
		throw new Error(`Glosa no usa el tier contributor (${modelo}): entrena con los datos`);
	}
}

function esperaConVariacion(intento: number): number {
	const base = 500 * 2 ** (intento - 1);
	return base + Math.floor(Math.random() * base);
}
