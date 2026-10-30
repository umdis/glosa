/**
 * Precios de la Meta Model API, tier Standard (dev.meta.ai/docs/pricing-rate-limits,
 * leídos el 2026-10-27). Solo se usan para estimar el gasto y aplicar el tope diario.
 */
interface PrecioTokens {
	entrada: number;
	cache: number;
	salida: number;
}

const POR_MILLON: Record<string, PrecioTokens> = {
	'muse-spark-1.3': { entrada: 1.25, cache: 0.15, salida: 4.25 },
	'muse-spark-1.2': { entrada: 1.25, cache: 0.15, salida: 4.25 },
	'muse-wonder-1.0': { entrada: 4.0, cache: 0.2, salida: 20.0 }
};

const TRANSCRIPCION_USD_POR_HORA = 0.18;

/** Muse Image: precio por imagen generada. */
export const COSTO_IMAGEN_USD = 0.01;

export function costoTokens(
	modelo: string,
	tokensEntrada: number,
	tokensCache: number,
	tokensSalida: number
): number {
	const precio = POR_MILLON[modelo];
	if (!precio) throw new Error(`Sin precio conocido para el modelo ${modelo}`);
	const sinCache = Math.max(tokensEntrada - tokensCache, 0);
	return (
		(sinCache * precio.entrada + tokensCache * precio.cache + tokensSalida * precio.salida) /
		1_000_000
	);
}

/** La transcripción se cobra por segundos enteros de audio, redondeando hacia abajo. */
export function costoTranscripcion(segundosAudio: number): number {
	return (Math.floor(segundosAudio) * TRANSCRIPCION_USD_POR_HORA) / 3600;
}
