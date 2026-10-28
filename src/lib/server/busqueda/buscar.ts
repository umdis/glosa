import type { Base } from '../db/base';
import { normalizar } from '../texto/normalizar';
import { raiz, textoARaices } from '../texto/raices';

/**
 * Búsqueda por lo dicho (design.md D2b): primero por raíces en español, ordenadas por bm25;
 * después, por trigramas, las coincidencias parciales que falten. Solo contenido visible.
 */

export interface Resultado {
	fragmentoId: number;
	videoId: string;
	titulo: string;
	inicioMs: number;
	finMs: number;
	/** Texto original del fragmento, tal como se dijo. */
	texto: string;
	/** Rangos [inicio, fin) del texto original que coinciden con la búsqueda. */
	marcas: Array<[number, number]>;
	via: 'raiz' | 'trigrama';
}

/** Largo mínimo de palabra para consultar los trigramas (el tokenizador no admite menos). */
const MINIMO_TRIGRAMA = 3;

interface Fila {
	id: number;
	video_id: string;
	titulo: string;
	inicio_ms: number;
	fin_ms: number;
	texto: string;
}

const COLUMNAS = `f.id, f.video_id, v.titulo, f.inicio_ms, f.fin_ms, f.texto`;

export function buscar(
	db: Base,
	consulta: string,
	opciones: { limite?: number; videoId?: string } = {}
): Resultado[] {
	const limite = opciones.limite ?? 40;
	const raices = [...new Set(textoARaices(consulta).split(' ').filter(Boolean))];
	const parciales = [
		...new Set(
			normalizar(consulta)
				.split(' ')
				.filter((p) => p.length >= MINIMO_TRIGRAMA)
		)
	];
	if (raices.length === 0 && parciales.length === 0) return [];

	const filtroVideo = opciones.videoId ? 'AND f.video_id = @videoId' : '';
	const resultados: Resultado[] = [];
	const vistos = new Set<number>();

	if (raices.length > 0) {
		const filas = db
			.prepare(
				`SELECT ${COLUMNAS} FROM fragmentos_raices r
				 JOIN fragmentos f ON f.id = r.rowid
				 JOIN videos v ON v.id = f.video_id
				 WHERE fragmentos_raices MATCH @consulta AND f.visibilidad = 'visible' ${filtroVideo}
				 ORDER BY bm25(fragmentos_raices) LIMIT @limite`
			)
			.all({ consulta: consultaFts(raices), videoId: opciones.videoId, limite }) as Fila[];
		for (const fila of filas) {
			vistos.add(fila.id);
			resultados.push(aResultado(fila, raices, parciales, 'raiz'));
		}
	}

	if (parciales.length > 0 && resultados.length < limite) {
		const filas = db
			.prepare(
				`SELECT ${COLUMNAS} FROM fragmentos_trigramas t
				 JOIN fragmentos f ON f.id = t.rowid
				 JOIN videos v ON v.id = f.video_id
				 WHERE fragmentos_trigramas MATCH @consulta AND f.visibilidad = 'visible' ${filtroVideo}
				 ORDER BY bm25(fragmentos_trigramas) LIMIT @limite`
			)
			.all({ consulta: consultaFts(parciales), videoId: opciones.videoId, limite }) as Fila[];
		for (const fila of filas) {
			if (vistos.has(fila.id) || resultados.length >= limite) continue;
			resultados.push(aResultado(fila, raices, parciales, 'trigrama'));
		}
	}
	return resultados;
}

/** Cada término entre comillas: todos deben aparecer. Los términos ya vienen sin símbolos. */
function consultaFts(terminos: string[]): string {
	return terminos.map((t) => `"${t.replaceAll('"', '')}"`).join(' ');
}

function aResultado(
	fila: Fila,
	raices: string[],
	parciales: string[],
	via: Resultado['via']
): Resultado {
	return {
		fragmentoId: fila.id,
		videoId: fila.video_id,
		titulo: fila.titulo,
		inicioMs: fila.inicio_ms,
		finMs: fila.fin_ms,
		texto: fila.texto,
		marcas: marcar(fila.texto, raices, parciales),
		via
	};
}

/** Rangos del texto original cuyas palabras coinciden por raíz o contienen un término parcial. */
export function marcar(
	texto: string,
	raices: string[],
	parciales: string[]
): Array<[number, number]> {
	const marcas: Array<[number, number]> = [];
	for (const m of texto.matchAll(/[\p{Letter}\p{Mark}\p{Number}]+/gu)) {
		const palabra = m[0];
		const coincide =
			raices.includes(raiz(palabra)) || parciales.some((p) => normalizar(palabra).includes(p));
		if (coincide) marcas.push([m.index, m.index + palabra.length]);
	}
	return marcas;
}
