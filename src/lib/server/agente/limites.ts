import type { Base } from '../db/base';
import { normalizar } from '../texto/normalizar';
import type { ResultadoAgente } from './agente';

/**
 * Límite de preguntas por visitante (design.md D10): ventana deslizante en memoria. Un reinicio
 * la vacía; para una demo basta, y el tope diario de gasto sigue protegiendo los créditos.
 */
export function crearLimitador(maximo: number, ventanaMs: number, ahora = () => Date.now()) {
	const registros = new Map<string, number[]>();
	return {
		/** Devuelve true y cuenta la pregunta si la persona aún tiene cupo. */
		permitir(clave: string): boolean {
			const limite = ahora() - ventanaMs;
			const recientes = (registros.get(clave) ?? []).filter((t) => t > limite);
			if (recientes.length >= maximo) {
				registros.set(clave, recientes);
				return false;
			}
			recientes.push(ahora());
			registros.set(clave, recientes);
			// Limpieza ocasional para que el mapa no crezca sin fin.
			if (registros.size > 5000) {
				for (const [k, v] of registros) if (v.every((t) => t <= limite)) registros.delete(k);
			}
			return true;
		}
	};
}

/** Guarda la última respuesta con evidencia verificada de cada pregunta. */
export function guardarRespuesta(db: Base, resultado: ResultadoAgente): void {
	const tieneRespaldo = resultado.afirmaciones.some((a) => a.respaldo === 'respaldada');
	if (!tieneRespaldo) return;
	db.prepare(
		`INSERT INTO respuestas_guardadas (pregunta_norma, resultado) VALUES (?, ?)
		 ON CONFLICT (pregunta_norma) DO UPDATE SET resultado = excluded.resultado, guardada_en = datetime('now')`
	).run(normalizar(resultado.pregunta), JSON.stringify(resultado));
}

/** Respuesta guardada para la misma pregunta (sin tildes, mayúsculas ni signos), si existe. */
export function respuestaGuardada(db: Base, pregunta: string): ResultadoAgente | null {
	const fila = db
		.prepare(`SELECT resultado FROM respuestas_guardadas WHERE pregunta_norma = ?`)
		.get(normalizar(pregunta)) as { resultado: string } | undefined;
	return fila ? (JSON.parse(fila.resultado) as ResultadoAgente) : null;
}
