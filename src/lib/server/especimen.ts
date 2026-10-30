/** El espécimen de la portada (interfaz-con-volumen D5). */

/**
 * Qué tan bien se lee sola una frase como espécimen: mejor si se está leyendo el versículo
 * («dice…») y si se citó un versículo concreto; peor con cada muletilla. A igualdad, la más larga.
 */
export function notaEspecimen(texto: string, versiculo: number | null): number {
	const muletillas = texto.match(/\b(eh|ah|este)\b/gi)?.length ?? 0;
	return (
		(/\bdice\b/i.test(texto) ? 1000 : 0) +
		(versiculo !== null ? 300 : 0) -
		50 * muletillas +
		Math.min(texto.length, 200)
	);
}
