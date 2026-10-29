/**
 * Ventana de un clip (spec clips-compartibles; design.md D5 de glosa-competitiva): el fragmento
 * citado más sus vecinos visibles y contiguos, hasta unos 30 s y nunca más de 60. Un fragmento
 * oculto o pendiente corta la ventana: su audio y su texto nunca entran en un clip.
 */

export const DURACION_MINIMA_MS = 15_000;
export const DURACION_OBJETIVO_MS = 30_000;
export const DURACION_MAXIMA_MS = 60_000;

export interface FragmentoDeVideo {
	id: number;
	orden: number;
	inicioMs: number;
	finMs: number;
	texto: string;
	visible: boolean;
}

export interface VentanaClip {
	inicioMs: number;
	finMs: number;
	fragmentos: FragmentoDeVideo[];
	/** El fragmento citado, el que da nombre al clip. */
	citado: FragmentoDeVideo;
}

/**
 * `fragmentos` son todos los del video (también los ocultos), en orden. Devuelve `null` si el
 * citado no es visible o si no se llega a la duración mínima sin tocar nada oculto.
 */
export function calcularVentana(
	fragmentos: FragmentoDeVideo[],
	fragmentoId: number
): VentanaClip | null {
	const i = fragmentos.findIndex((f) => f.id === fragmentoId);
	if (i < 0 || !fragmentos[i].visible) return null;

	let desde = i;
	let hasta = i;
	const duracion = (a: number, b: number) => fragmentos[b].finMs - fragmentos[a].inicioMs;
	// Se crece de a un fragmento, prefiriendo lo que sigue (la cita suele abrir la idea), mientras
	// no se alcance el objetivo y el siguiente paso no pase del máximo.
	while (duracion(desde, hasta) < DURACION_OBJETIVO_MS) {
		const adelante = hasta + 1 < fragmentos.length && fragmentos[hasta + 1].visible;
		const atras = desde > 0 && fragmentos[desde - 1].visible;
		if (adelante && duracion(desde, hasta + 1) <= DURACION_MAXIMA_MS) hasta++;
		else if (atras && duracion(desde - 1, hasta) <= DURACION_MAXIMA_MS) desde--;
		else break;
	}

	if (duracion(desde, hasta) < DURACION_MINIMA_MS) return null;
	return {
		inicioMs: fragmentos[desde].inicioMs,
		finMs: fragmentos[hasta].finMs,
		fragmentos: fragmentos.slice(desde, hasta + 1),
		citado: fragmentos[i]
	};
}
