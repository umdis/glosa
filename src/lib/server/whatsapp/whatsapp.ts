import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ResultadoAgente } from '../agente/agente';
import type { Base } from '../db/base';
import { folio } from '../../formato';

/**
 * Preguntar por WhatsApp (spec whatsapp; design.md D12): webhook propio de la Cloud API, sin SDK.
 * Del remitente solo se guarda un HMAC de su número, y solo para el límite diario; el texto de la
 * conversación no se guarda. Glosa solo responde a quien escribe: nunca inicia conversaciones.
 */

export const GRAPH = 'https://graph.facebook.com/v21.0';

/** Preguntas por número y día. */
export const PREGUNTAS_POR_DIA = 10;

/** Largo máximo de un mensaje de texto de WhatsApp. */
const MAXIMO_MENSAJE = 4096;

/**
 * Comprueba `X-Hub-Signature-256: sha256=<hex>` contra el HMAC-SHA256 del cuerpo crudo con el
 * secreto de la app, en tiempo constante. Sin secreto configurado, nada es válido.
 */
export function firmaValida(
	cuerpo: string,
	cabecera: string | null,
	secreto: string | undefined
): boolean {
	if (!secreto || !cabecera?.startsWith('sha256=')) return false;
	const esperada = createHmac('sha256', secreto).update(cuerpo, 'utf8').digest();
	const recibida = Buffer.from(cabecera.slice('sha256='.length), 'hex');
	return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

/** Reto de verificación del webhook: devuelve `hub.challenge` solo si el token coincide. */
export function responderReto(
	parametros: URLSearchParams,
	tokenVerificacion: string | undefined
): string | null {
	if (!tokenVerificacion) return null;
	const token = parametros.get('hub.verify_token') ?? '';
	const a = Buffer.from(token);
	const b = Buffer.from(tokenVerificacion);
	const coincide = a.length === b.length && timingSafeEqual(a, b);
	if (parametros.get('hub.mode') !== 'subscribe' || !coincide) return null;
	return parametros.get('hub.challenge');
}

export interface MensajeEntrante {
	id: string;
	/** wa_id del remitente: solo para responderle; no se guarda. */
	de: string;
	tipo: string;
	texto?: string;
}

/** Los mensajes de un evento del webhook (`entry[].changes[].value.messages[]`). Ignora estados. */
export function leerMensajes(evento: unknown): MensajeEntrante[] {
	const mensajes: MensajeEntrante[] = [];
	const entradas = (evento as { entry?: unknown[] })?.entry;
	if (!Array.isArray(entradas)) return mensajes;
	for (const entrada of entradas) {
		const cambios = (entrada as { changes?: unknown[] })?.changes;
		if (!Array.isArray(cambios)) continue;
		for (const cambio of cambios) {
			const valor = (cambio as { value?: { messages?: unknown[] } })?.value;
			for (const m of valor?.messages ?? []) {
				const crudo = m as {
					id?: unknown;
					from?: unknown;
					type?: unknown;
					text?: { body?: unknown };
				};
				if (typeof crudo.id !== 'string' || typeof crudo.from !== 'string') continue;
				mensajes.push({
					id: crudo.id,
					de: crudo.from,
					tipo: typeof crudo.type === 'string' ? crudo.type : 'desconocido',
					...(typeof crudo.text?.body === 'string' ? { texto: crudo.text.body } : {})
				});
			}
		}
	}
	return mensajes;
}

/** Identificador del remitente no reversible: HMAC del número con el secreto de la app. */
export function remitente(numero: string, secreto: string): string {
	return createHmac('sha256', secreto).update(`glosa-wa:${numero}`).digest('hex');
}

/**
 * Cuenta una pregunta del remitente hoy y dice si aún tenía cupo. Borra los días viejos: no se
 * guarda historial.
 */
export function contarPregunta(db: Base, idRemitente: string, maximo = PREGUNTAS_POR_DIA): boolean {
	return db.transaction(() => {
		db.prepare(`DELETE FROM whatsapp_uso WHERE dia < date('now', '-1 day')`).run();
		const fila = db
			.prepare(`SELECT preguntas FROM whatsapp_uso WHERE remitente = ? AND dia = date('now')`)
			.get(idRemitente) as { preguntas: number } | undefined;
		if ((fila?.preguntas ?? 0) >= maximo) return false;
		db.prepare(
			`INSERT INTO whatsapp_uso (remitente, dia, preguntas) VALUES (?, date('now'), 1)
			 ON CONFLICT (remitente, dia) DO UPDATE SET preguntas = preguntas + 1`
		).run(idRemitente);
		return true;
	})();
}

/** Textos fijos, en inglés y español: el número puede recibir cualquiera de los dos. */
export const AVISOS = {
	soloTexto:
		'Glosa only answers written questions for now. / Por ahora Glosa solo responde preguntas escritas.',
	limite:
		'You reached today’s question limit. Try again tomorrow, or search at https://glosa.umdis.site / Llegaste al límite de preguntas de hoy.',
	tope: 'The demo reached its daily limit. Search still works at https://glosa.umdis.site / La demo llegó a su límite diario.',
	error: 'Glosa could not answer right now. Try again in a moment. / Glosa no pudo responder ahora.'
};

/**
 * La respuesta como mensaje de WhatsApp: las afirmaciones respaldadas y hasta tres citas
 * verificadas, cada una con su minuto y el enlace a ese momento (spec whatsapp).
 */
export function formatearRespuesta(resultado: ResultadoAgente, base: string): string {
	const espanol = (resultado.idioma ?? 'es') === 'es';
	if (resultado.sinEvidencia) {
		return espanol
			? 'Los videos no hablan de esto, o no con palabras que Glosa pudiera encontrar. Prueba con las palabras que usaría quien habla.'
			: 'The videos do not talk about this, or not in words Glosa could find. Try the words the speaker would use.';
	}
	const respaldadas = resultado.afirmaciones.filter((a) => a.respaldo === 'respaldada');
	const citas = respaldadas
		.flatMap((a) => a.citas)
		.filter((c) => c.estado === 'verificada')
		.filter((c, i, todas) => todas.findIndex((o) => o.fragmentoId === c.fragmentoId) === i)
		.slice(0, 3);
	const lineas = [respaldadas.map((a) => a.texto).join(' ')];
	for (const c of citas) {
		if (c.estado !== 'verificada') continue;
		const enlace = `${base}/videos/${c.videoId}?t=${Math.floor(c.inicioMs / 1000)}#f-${c.fragmentoId}`;
		lineas.push(
			[
				`▶ ${folio(c.inicioMs)} — ${c.titulo}`,
				`«${c.frase}»`,
				...(c.traduccion ? [`(${c.traduccion})`] : []),
				enlace
			].join('\n')
		);
	}
	lineas.push(
		espanol
			? 'Cada cita se comprobó contra lo que se dijo en el video.'
			: 'Every quote was checked against what was said in the video.'
	);
	const mensaje = lineas.join('\n\n');
	return mensaje.length <= MAXIMO_MENSAJE ? mensaje : `${mensaje.slice(0, MAXIMO_MENSAJE - 1)}…`;
}

export interface ConfiguracionEnvio {
	token: string;
	idNumero: string;
	fetch?: typeof fetch;
}

/** Envía un texto por la Cloud API. Sin vista previa de enlaces: el mensaje ya trae el minuto. */
export async function enviarTexto(
	config: ConfiguracionEnvio,
	para: string,
	texto: string
): Promise<void> {
	const respuesta = await (config.fetch ?? fetch)(`${GRAPH}/${config.idNumero}/messages`, {
		method: 'POST',
		headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			messaging_product: 'whatsapp',
			recipient_type: 'individual',
			to: para,
			type: 'text',
			text: { body: texto, preview_url: false }
		}),
		signal: AbortSignal.timeout(30_000)
	});
	if (!respuesta.ok) {
		// El cuerpo de error de Graph no lleva datos del remitente, pero se recorta igual.
		throw new Error(`WhatsApp ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}`);
	}
}

/** Ids de mensajes ya atendidos: Meta reintenta un evento si no recibió el 200 a tiempo. */
const atendidos = new Map<string, number>();

export function yaAtendido(id: string, ahora = Date.now()): boolean {
	for (const [clave, momento] of atendidos)
		if (ahora - momento > 3_600_000) atendidos.delete(clave);
	if (atendidos.has(id)) return true;
	atendidos.set(id, ahora);
	return false;
}

export interface DependenciasWhatsApp {
	db: Base;
	secreto: string;
	envio: ConfiguracionEnvio;
	base: string;
	topeAlcanzado: () => boolean;
	/** `atenderPregunta` con el remitente como visitante: los mismos límites y respaldo. */
	preguntar: (
		texto: string,
		visitante: string
	) => Promise<
		{ ok: true; resultado: ResultadoAgente } | { ok: false; estado: number; error: string }
	>;
}

/** Atiende un mensaje: un único envío de vuelta, pase lo que pase. */
export async function atenderMensaje(
	deps: DependenciasWhatsApp,
	mensaje: MensajeEntrante
): Promise<void> {
	if (yaAtendido(mensaje.id)) return;
	const responder = (texto: string) => enviarTexto(deps.envio, mensaje.de, texto);
	if (mensaje.tipo !== 'text' || !mensaje.texto?.trim()) return responder(AVISOS.soloTexto);
	if (deps.topeAlcanzado()) return responder(AVISOS.tope);
	const id = remitente(mensaje.de, deps.secreto);
	if (!contarPregunta(deps.db, id)) return responder(AVISOS.limite);
	const atencion = await deps.preguntar(mensaje.texto.trim().slice(0, 300), `wa:${id}`);
	// 400 y 429 traen su motivo («Write a question…», «Wait a few minutes…»); 502 es del servicio.
	if (!atencion.ok) return responder(atencion.estado === 502 ? AVISOS.error : atencion.error);
	return responder(formatearRespuesta(atencion.resultado, deps.base));
}
