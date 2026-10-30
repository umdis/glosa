import { json } from '@sveltejs/kit';
import { crearLimitador } from '#lib/server/agente/limites.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { MAXIMO_BYTES_VOZ, validarWavVoz } from '#lib/server/voz.js';
import type { RequestHandler } from './$types';

/** Diez dictados cada diez minutos por visitante. */
const limitador = crearLimitador(10, 10 * 60_000);

/**
 * Transcribe una pregunta dictada con Muse Voice Transcribe y devuelve el texto. No envía la
 * pregunta: la persona la revisa en el campo y pulsa «Ask». El audio no se guarda.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!request.headers.get('content-type')?.startsWith('audio/wav')) {
		return json({ error: 'Send the recording as audio/wav.' }, { status: 415 });
	}
	const largo = Number(request.headers.get('content-length') ?? 0);
	if (largo > MAXIMO_BYTES_VOZ) {
		return json({ error: 'Recordings are limited to 30 seconds.' }, { status: 413 });
	}
	const bytes = new Uint8Array(await request.arrayBuffer());
	const wav = validarWavVoz(bytes);
	if (!wav.ok) return json({ error: wav.error }, { status: 400 });

	const { meta, topeAlcanzado } = obtenerServicios();
	if (topeAlcanzado()) {
		return json(
			{ error: 'This demo reached its daily limit. You can still type the question.' },
			{ status: 429 }
		);
	}
	if (!limitador.permitir(getClientAddress())) {
		return json(
			{ error: 'You dictated several questions in a row. Wait a few minutes or type it.' },
			{ status: 429 }
		);
	}

	try {
		const resultado = await meta.transcribir(new Blob([bytes], { type: 'audio/wav' }), {
			modo: 'PUSH_TO_TALK'
		});
		const texto = (resultado.transcript || resultado.turns.map((t) => t.transcript).join(' '))
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 300);
		if (!texto)
			return json(
				{ error: 'Glosa did not hear any words. Try again closer to the microphone.' },
				{ status: 422 }
			);
		return json({ texto });
	} catch (error) {
		console.error('Falló la transcripción de la pregunta', error);
		return json(
			{ error: 'The voice service did not answer. You can type the question.' },
			{ status: 502 }
		);
	}
};
