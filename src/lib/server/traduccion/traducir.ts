import type { Base } from '../db/base';
import { MODELO_RAZONAMIENTO, type ClienteMeta } from '../meta/cliente';

/**
 * Traducciones con Muse Spark (spec idiomas-y-voz; design.md D6 de glosa-competitiva). Se piden en
 * lote con salida estructurada y se guardan por el texto original, de modo que una frase o un
 * fragmento se traduce una sola vez por idioma. Una traducción es ayuda de lectura, nunca evidencia.
 */

/** Idiomas a los que se traduce: un código ISO 639-1 en minúsculas y nada más. */
export function idiomaValido(idioma: unknown): string | null {
	return typeof idioma === 'string' && /^[a-z]{2}$/.test(idioma) ? idioma : null;
}

/** Nombres para el modelo y para la interfaz; un código desconocido se usa tal cual. */
const NOMBRES: Record<string, string> = {
	en: 'English',
	es: 'Spanish',
	pt: 'Portuguese',
	fr: 'French',
	de: 'German',
	it: 'Italian'
};
export const nombreIdioma = (idioma: string) => NOMBRES[idioma] ?? idioma;

const TAMANO_LOTE = 80;

const ESQUEMA = {
	type: 'json_schema',
	json_schema: {
		name: 'traducciones_glosa',
		schema: {
			type: 'object',
			properties: {
				traducciones: {
					type: 'array',
					items: {
						type: 'object',
						properties: { n: { type: 'integer' }, texto: { type: 'string' } },
						required: ['n', 'texto'],
						additionalProperties: false
					}
				}
			},
			required: ['traducciones'],
			additionalProperties: false
		}
	}
};

/** Las traducciones ya guardadas de esos textos. */
export function traduccionesGuardadas(
	db: Base,
	textos: string[],
	idioma: string
): Map<string, string> {
	const leer = db.prepare(`SELECT texto FROM traducciones WHERE original = ? AND idioma = ?`);
	const salida = new Map<string, string>();
	for (const original of new Set(textos)) {
		const fila = leer.get(original, idioma) as { texto: string } | undefined;
		if (fila) salida.set(original, fila.texto);
	}
	return salida;
}

/**
 * Traduce los textos que aún no estén guardados, en lotes, y devuelve todos los disponibles.
 * Lo que el modelo no devuelva (o devuelva vacío) simplemente queda sin traducción.
 */
export async function traducir(
	db: Base,
	meta: Pick<ClienteMeta, 'chat'>,
	textos: string[],
	idioma: string,
	operacion = 'traducir'
): Promise<Map<string, string>> {
	const salida = traduccionesGuardadas(db, textos, idioma);
	const faltan = [...new Set(textos)].filter((t) => t.trim() && !salida.has(t));
	const guardar = db.prepare(
		`INSERT INTO traducciones (original, idioma, texto) VALUES (?, ?, ?)
		 ON CONFLICT (original, idioma) DO UPDATE SET texto = excluded.texto`
	);

	for (let i = 0; i < faltan.length; i += TAMANO_LOTE) {
		const lote = faltan.slice(i, i + TAMANO_LOTE);
		const respuesta = await meta.chat(
			{
				model: MODELO_RAZONAMIENTO,
				messages: [
					{
						role: 'system',
						content: `Translate each numbered line from a spoken sermon transcript into ${nombreIdioma(idioma)}. Keep the meaning and the speaker's tone; do not add, explain or summarize. Bible references keep their book, chapter and verse. Return one translation per number.`
					},
					{ role: 'user', content: lote.map((t, n) => `${n + 1}. ${t}`).join('\n') }
				],
				response_format: ESQUEMA
			},
			operacion
		);
		for (const { n, texto } of leerTraducciones(respuesta.choices[0]?.message.content ?? '')) {
			const original = lote[n - 1];
			if (!original || !texto.trim()) continue;
			guardar.run(original, idioma, texto.trim());
			salida.set(original, texto.trim());
		}
	}
	return salida;
}

/** Lee la salida del modelo tolerando campos de más y descartando lo mal formado. */
export function leerTraducciones(contenido: string): Array<{ n: number; texto: string }> {
	try {
		const datos = JSON.parse(contenido) as { traducciones?: unknown };
		if (!Array.isArray(datos.traducciones)) return [];
		return datos.traducciones.filter(
			(t): t is { n: number; texto: string } =>
				Number.isInteger(t?.n) && typeof t?.texto === 'string'
		);
	} catch {
		return [];
	}
}
