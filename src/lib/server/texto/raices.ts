import { stemmer } from '@orama/stemmers/spanish';
import { normalizar } from './normalizar';

/**
 * Raíces en español (Snowball) para el índice de búsqueda (design.md D2b).
 * El stemmer se aplica **antes** de quitar las tildes: con ellas da raíces más consistentes
 * («teología» → «teolog»; sin tilde saldría «teologi»). Después se normaliza la raíz.
 * Nunca se muestra al usuario ni se usa para verificar citas.
 */
export function raiz(palabra: string): string {
	return normalizar(stemmer(palabra.toLowerCase()));
}

/** Palabras del texto (minúsculas, con tildes) separadas por cualquier cosa que no sea letra o número. */
export function palabrasDe(texto: string): string[] {
	return texto
		.toLowerCase()
		.split(/[^\p{Letter}\p{Mark}\p{Number}]+/u)
		.filter(Boolean);
}

/** Texto reducido a raíces, separado por espacios: lo que se guarda en `texto_raiz`. */
export function textoARaices(texto: string): string {
	return palabrasDe(texto).map(raiz).filter(Boolean).join(' ');
}
