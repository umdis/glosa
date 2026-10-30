import { atenderPregunta } from '#lib/server/agente/atender.js';
import type { RequestHandler } from './$types';

/**
 * La misma pregunta que la acción de `/ask`, pero transmitida (interfaz-con-volumen D1): una línea
 * JSON por cada paso real del agente y una última con la respuesta o el error. Un POST con cuerpo
 * JSON no lo puede enviar un formulario de otro sitio, y el formulario sin JS sigue en la acción.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let pregunta: unknown;
	try {
		pregunta = ((await request.json()) as { pregunta?: unknown }).pregunta;
	} catch {
		pregunta = '';
	}
	const visitante = getClientAddress();
	const codificar = new TextEncoder();

	const cuerpo = new ReadableStream<Uint8Array>({
		async start(control) {
			const enviar = (mensaje: object) =>
				control.enqueue(codificar.encode(`${JSON.stringify(mensaje)}\n`));
			const atencion = await atenderPregunta(pregunta, visitante, (paso) =>
				enviar({ tipo: 'paso', paso })
			);
			enviar(
				atencion.ok
					? { tipo: 'fin', resultado: atencion.resultado, desdeGuardada: atencion.desdeGuardada }
					: { tipo: 'error', error: atencion.error }
			);
			control.close();
		}
	});

	return new Response(cuerpo, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'cache-control': 'no-store',
			// Traefik y otros proxies no deben retener la respuesta hasta el final.
			'x-accel-buffering': 'no'
		}
	});
};
