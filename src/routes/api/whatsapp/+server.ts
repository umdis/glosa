import { error, text } from '@sveltejs/kit';
import {
	WHATSAPP_APP_SECRET,
	WHATSAPP_PHONE_NUMBER_ID,
	WHATSAPP_TOKEN,
	WHATSAPP_VERIFY_TOKEN
} from '$app/env/private';
import { atenderPregunta } from '#lib/server/agente/atender.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import {
	atenderMensaje,
	firmaValida,
	leerMensajes,
	responderReto
} from '#lib/server/whatsapp/whatsapp.js';
import type { RequestHandler } from './$types';

/**
 * Webhook de WhatsApp (spec whatsapp; design.md D12).
 * GET: reto de verificación de Meta. POST: eventos firmados con el secreto de la app; se responde
 * 200 enseguida y la pregunta se atiende en segundo plano (Meta reintenta si tarda).
 */
export const GET: RequestHandler = ({ url }) => {
	const reto = responderReto(url.searchParams, WHATSAPP_VERIFY_TOKEN);
	if (reto === null) error(403, 'Verification failed');
	return text(reto);
};

export const POST: RequestHandler = async ({ request, url }) => {
	const cuerpo = await request.text();
	if (!firmaValida(cuerpo, request.headers.get('x-hub-signature-256'), WHATSAPP_APP_SECRET)) {
		error(401, 'Invalid signature');
	}
	let evento: unknown;
	try {
		evento = JSON.parse(cuerpo);
	} catch {
		error(400, 'Invalid JSON');
	}
	const mensajes = leerMensajes(evento);
	if (mensajes.length && WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID && WHATSAPP_APP_SECRET) {
		const { db, topeAlcanzado } = obtenerServicios();
		const deps = {
			db,
			secreto: WHATSAPP_APP_SECRET,
			envio: { token: WHATSAPP_TOKEN, idNumero: WHATSAPP_PHONE_NUMBER_ID },
			base: url.origin,
			topeAlcanzado,
			preguntar: (texto: string, visitante: string) => atenderPregunta(texto, visitante)
		};
		for (const mensaje of mensajes) {
			// Sin datos del remitente ni del texto en el registro: solo que falló.
			atenderMensaje(deps, mensaje).catch((e) =>
				console.error('WhatsApp: no se pudo atender un mensaje', (e as Error).message)
			);
		}
	}
	return text('ok');
};
