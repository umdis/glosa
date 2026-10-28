/** Virgulilla combinante (U+0303): en «n» + virgulilla es la ñ, que sí cambia la palabra. */
const VIRGULILLA = String.fromCodePoint(0x0303);

/**
 * Normalización compartida por la fusión de ventanas, la búsqueda y la verificación de citas:
 * minúsculas, sin tildes (pero conservando la ñ), sin puntuación y con espacios simples.
 */
export function normalizar(texto: string): string {
	return texto
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Mn}/gu, (marca, pos: number, todo: string) =>
			marca === VIRGULILLA && todo[pos - 1] === 'n' ? marca : ''
		)
		.normalize('NFC')
		.replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Palabras normalizadas de un texto, en orden. */
export function palabrasNormalizadas(texto: string): string[] {
	const limpio = normalizar(texto);
	return limpio ? limpio.split(' ') : [];
}
