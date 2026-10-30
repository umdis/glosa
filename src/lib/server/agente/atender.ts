import { obtenerServicios } from '../servicios';
import { preguntar, type PasoAgente, type ResultadoAgente } from './agente';
import { crearLimitador, guardarRespuesta, respuestaGuardada } from './limites';

/**
 * Atender una pregunta (interfaz-con-volumen D3): validación, límite por visitante, tope de gasto
 * y respuesta guardada en un solo sitio, para que el formulario sin JavaScript y la transmisión
 * en vivo de `/ask/stream` se comporten igual.
 */

/** Seis preguntas cada diez minutos por visitante: suficiente para probar, no para abusar. */
const limitador = crearLimitador(6, 10 * 60_000);

export type Atencion =
	| { ok: true; pregunta: string; resultado: ResultadoAgente; desdeGuardada: boolean }
	| { ok: false; estado: 400 | 429 | 502; pregunta: string; error: string };

export async function atenderPregunta(
	entrada: unknown,
	visitante: string,
	alPaso?: (paso: PasoAgente) => void
): Promise<Atencion> {
	const pregunta = String(entrada ?? '').trim();
	if (pregunta.length < 3) {
		return { ok: false, estado: 400, pregunta, error: 'Write a question of at least a few words.' };
	}
	if (pregunta.length > 300) {
		return { ok: false, estado: 400, pregunta, error: 'Keep the question under 300 characters.' };
	}

	const { db, meta, topeAlcanzado } = obtenerServicios();
	const guardada = () => respuestaGuardada(db, pregunta);

	if (topeAlcanzado()) {
		const resultado = guardada();
		if (resultado) return { ok: true, pregunta, resultado, desdeGuardada: true };
		return {
			ok: false,
			estado: 429,
			pregunta,
			error:
				'This demo reached its daily question limit. Search still works; questions open again tomorrow.'
		};
	}
	if (!limitador.permitir(visitante)) {
		return {
			ok: false,
			estado: 429,
			pregunta,
			error: 'You asked several questions in a row. Wait a few minutes; search still works.'
		};
	}

	try {
		const resultado = await preguntar(db, meta, pregunta, { alPaso });
		guardarRespuesta(db, resultado);
		return { ok: true, pregunta, resultado, desdeGuardada: false };
	} catch (error) {
		console.error('Falló el agente', error);
		const resultado = guardada();
		if (resultado) return { ok: true, pregunta, resultado, desdeGuardada: true };
		return {
			ok: false,
			estado: 502,
			pregunta,
			error: 'The AI service did not answer. Try again in a moment.'
		};
	}
}
