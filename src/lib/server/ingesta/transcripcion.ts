import type { ClienteMeta } from '../meta/cliente';
import type { VentanaWav } from '../medios/wav';
import type { VentanaTranscrita } from './fusion';

export interface OpcionesTranscribirVentanas {
	concurrencia?: number;
	idiomas?: string[];
	palabrasClave?: string[];
	/** Se llama al terminar cada ventana, para informar el avance. */
	alAvanzar?: (hechas: number, total: number) => void;
}

/**
 * Transcribe las ventanas en paralelo con un número fijo de peticiones simultáneas.
 * El cliente ya reintenta cada petición; si una ventana falla igualmente, falla todo el paso
 * para que se pueda reintentar entero (no se guardan transcripciones con huecos).
 */
export async function transcribirVentanas(
	cliente: Pick<ClienteMeta, 'transcribir'>,
	ventanas: VentanaWav[],
	opciones: OpcionesTranscribirVentanas = {}
): Promise<VentanaTranscrita[]> {
	const concurrencia = Math.max(1, opciones.concurrencia ?? 8);
	const resultados = new Array<VentanaTranscrita>(ventanas.length);
	let siguiente = 0;
	let hechas = 0;

	const trabajador = async () => {
		while (siguiente < ventanas.length) {
			const indice = siguiente++;
			const ventana = ventanas[indice];
			const respuesta = await cliente.transcribir(
				new Blob([ventana.wav as Uint8Array<ArrayBuffer>], { type: 'audio/wav' }),
				{ idiomas: opciones.idiomas, palabrasClave: opciones.palabrasClave }
			);
			resultados[indice] = {
				inicioMs: ventana.inicioMs,
				duracionMs: ventana.duracionMs,
				turnos: respuesta.turns.map((t) => ({
					startMs: t.startMs,
					endMs: t.endMs,
					transcript: t.transcript ?? ''
				}))
			};
			opciones.alAvanzar?.(++hechas, ventanas.length);
		}
	};

	await Promise.all(Array.from({ length: Math.min(concurrencia, ventanas.length) }, trabajador));
	return resultados;
}
