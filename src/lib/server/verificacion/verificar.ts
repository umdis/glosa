import type { Base } from '../db/base';
import { palabrasNormalizadas } from '../texto/normalizar';

/**
 * Verificación de citas (design.md D7). El agente cita por identificador de fragmento y frase
 * textual; aquí se comprueba que la frase se dijo de verdad en ese fragmento o en sus vecinos, y
 * el minuto se toma del fragmento donde empieza la frase. Nada de lo que diga el modelo sobre
 * minutos se usa: si la cita trae uno, se ignora.
 */

export interface CitaPropuesta {
	fragmentoId: number;
	frase: string;
}

export interface AfirmacionPropuesta {
	texto: string;
	citas: CitaPropuesta[];
}

export type MotivoNoVerificada = 'fragmento_inexistente' | 'demasiado_corta' | 'no_encontrada';

export type CitaVerificada =
	| {
			estado: 'verificada';
			frase: string;
			fragmentoId: number;
			videoId: string;
			titulo: string;
			inicioMs: number;
			/** Proporción de palabras de la frase halladas en orden (0–1). */
			coincidencia: number;
	  }
	| {
			estado: 'no_verificada';
			frase: string;
			fragmentoId: number;
			motivo: MotivoNoVerificada;
			coincidencia: number;
	  };

export interface AfirmacionVerificada {
	texto: string;
	respaldo: 'respaldada' | 'sin_respaldo';
	citas: CitaVerificada[];
}

export interface OpcionesVerificacion {
	/** Coincidencia mínima para dar por buena una cita (0,85 por defecto). */
	umbral?: number;
	/** Fragmentos vecinos, a cada lado, donde también se busca la frase. */
	vecinos?: number;
	/** Una frase más corta que esto no sirve como respaldo («Dios», «la fe»). */
	minimoPalabras?: number;
}

interface FilaFragmento {
	id: number;
	video_id: string;
	orden: number;
	inicio_ms: number;
	texto: string;
	titulo: string;
}

export function verificarAfirmaciones(
	db: Base,
	afirmaciones: AfirmacionPropuesta[],
	opciones: OpcionesVerificacion = {}
): AfirmacionVerificada[] {
	const verificador = crearVerificador(db, opciones);
	return afirmaciones.map((afirmacion) => {
		const citas = afirmacion.citas.map((c) => verificador(c));
		return {
			texto: afirmacion.texto,
			respaldo: citas.some((c) => c.estado === 'verificada') ? 'respaldada' : 'sin_respaldo',
			citas
		};
	});
}

/** Devuelve una función que verifica citas sueltas contra la base. */
export function crearVerificador(db: Base, opciones: OpcionesVerificacion = {}) {
	const umbral = opciones.umbral ?? 0.85;
	const vecinos = opciones.vecinos ?? 1;
	const minimoPalabras = opciones.minimoPalabras ?? 3;

	// Solo se puede citar lo visible: lo pendiente de revisión y lo oculto no respaldan nada.
	const citado = db.prepare(
		`SELECT f.id, f.video_id, f.orden, f.inicio_ms, f.texto, v.titulo
		 FROM fragmentos f JOIN videos v ON v.id = f.video_id
		 WHERE f.id = ? AND f.visibilidad = 'visible'`
	);
	const entorno = db.prepare(
		`SELECT f.id, f.video_id, f.orden, f.inicio_ms, f.texto, v.titulo
		 FROM fragmentos f JOIN videos v ON v.id = f.video_id
		 WHERE f.video_id = ? AND f.orden BETWEEN ? AND ? AND f.visibilidad = 'visible'
		 ORDER BY f.orden`
	);

	return (cita: CitaPropuesta): CitaVerificada => {
		const frase = cita.frase;
		const base = { frase, fragmentoId: cita.fragmentoId };
		const palabrasFrase = palabrasNormalizadas(frase);
		if (palabrasFrase.length < minimoPalabras) {
			return { ...base, estado: 'no_verificada', motivo: 'demasiado_corta', coincidencia: 0 };
		}
		const fila = citado.get(cita.fragmentoId) as FilaFragmento | undefined;
		if (!fila) {
			return { ...base, estado: 'no_verificada', motivo: 'fragmento_inexistente', coincidencia: 0 };
		}

		const candidatos = entorno.all(
			fila.video_id,
			fila.orden - vecinos,
			fila.orden + vecinos
		) as FilaFragmento[];
		// Palabras de los candidatos en orden, recordando de qué fragmento viene cada una.
		const palabras: string[] = [];
		const origen: FilaFragmento[] = [];
		for (const candidato of candidatos) {
			for (const palabra of palabrasNormalizadas(candidato.texto)) {
				palabras.push(palabra);
				origen.push(candidato);
			}
		}

		const mejor = mejorAlineacion(palabrasFrase, palabras);
		if (mejor.coincidencia < umbral || mejor.primera < 0) {
			return {
				...base,
				estado: 'no_verificada',
				motivo: 'no_encontrada',
				coincidencia: mejor.coincidencia
			};
		}
		const ancla = origen[mejor.primera];
		return {
			estado: 'verificada',
			frase,
			fragmentoId: ancla.id,
			videoId: ancla.video_id,
			titulo: ancla.titulo,
			inicioMs: ancla.inicio_ms,
			coincidencia: mejor.coincidencia
		};
	};
}

/**
 * Busca la ventana del texto que contiene, en orden, la mayor parte de las palabras de la frase.
 * La ventana es algo más larga que la frase para tolerar las muletillas del habla («eh»,
 * «de de la») que el modelo suele quitar al citar, pero no tanto como para dar por buena una
 * frase cuyas palabras están desperdigadas por todo el fragmento.
 */
export function mejorAlineacion(
	frase: string[],
	texto: string[]
): { coincidencia: number; primera: number } {
	if (frase.length === 0 || texto.length === 0) return { coincidencia: 0, primera: -1 };
	const largoVentana = Math.ceil(frase.length * 1.3) + 2;
	let mejor = { aciertos: 0, primera: -1 };
	for (let inicio = 0; inicio < texto.length; inicio++) {
		// Solo tiene sentido empezar donde aparece alguna palabra de la frase.
		if (!frase.includes(texto[inicio])) continue;
		const ventana = texto.slice(inicio, inicio + largoVentana);
		const aciertos = subsecuenciaComun(frase, ventana);
		if (aciertos > mejor.aciertos) mejor = { aciertos, primera: inicio };
		if (aciertos === frase.length) break;
	}
	return { coincidencia: mejor.aciertos / frase.length, primera: mejor.primera };
}

/** Largo de la subsecuencia común más larga (no necesariamente contigua). */
function subsecuenciaComun(a: string[], b: string[]): number {
	let previa = new Array<number>(b.length + 1).fill(0);
	for (let i = 1; i <= a.length; i++) {
		const actual = new Array<number>(b.length + 1).fill(0);
		for (let j = 1; j <= b.length; j++) {
			actual[j] = a[i - 1] === b[j - 1] ? previa[j - 1] + 1 : Math.max(previa[j], actual[j - 1]);
		}
		previa = actual;
	}
	return previa[b.length];
}
