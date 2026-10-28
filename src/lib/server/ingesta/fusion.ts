import { normalizar } from '../texto/normalizar';

/**
 * Convierte las transcripciones de ventanas solapadas en una sola secuencia de palabras con
 * tiempos absolutos, y la parte en fragmentos citables de 20 s o menos (design.md D4).
 *
 * La API solo da marcas por turno, así que el tiempo de cada palabra se interpola dentro de su
 * turno según la posición del texto. Es una aproximación de pocos segundos, suficiente porque la
 * cita se ancla al inicio del fragmento, no a la palabra.
 */

export interface TurnoRelativo {
	startMs: number;
	endMs: number;
	transcript: string;
}

export interface VentanaTranscrita {
	/** Inicio absoluto de la ventana en el audio. */
	inicioMs: number;
	duracionMs: number;
	turnos: TurnoRelativo[];
}

export interface Palabra {
	texto: string;
	norma: string;
	inicioMs: number;
	finMs: number;
}

export interface Fragmento {
	inicioMs: number;
	finMs: number;
	texto: string;
}

/** Tolerancia al buscar palabras de la zona de solape, porque sus tiempos son interpolados. */
const TOLERANCIA_SOLAPE_MS = 1_500;
/** Coincidencia mínima, en palabras, para confiar en la alineación del solape. */
const MINIMO_ALINEACION = 2;

/** Palabras de una ventana con tiempos absolutos, interpolados dentro de cada turno. */
export function palabrasDeVentana(ventana: VentanaTranscrita): Palabra[] {
	const palabras: Palabra[] = [];
	for (const turno of ventana.turnos) {
		const piezas = turno.transcript.split(/\s+/).filter(Boolean);
		if (piezas.length === 0) continue;
		const inicioTurno = ventana.inicioMs + turno.startMs;
		const duracion = Math.max(turno.endMs - turno.startMs, 0);
		const totalCaracteres = piezas.reduce((suma, p) => suma + p.length + 1, 0);
		let caracteresPrevios = 0;
		const turnoPalabras: Palabra[] = [];
		for (const pieza of piezas) {
			const inicio = inicioTurno + Math.round((duracion * caracteresPrevios) / totalCaracteres);
			caracteresPrevios += pieza.length + 1;
			const norma = normalizar(pieza);
			if (!norma) continue;
			turnoPalabras.push({ texto: pieza, norma, inicioMs: inicio, finMs: inicio });
		}
		// Cada palabra termina donde empieza la siguiente; la última, al final del turno.
		turnoPalabras.forEach((p, i) => {
			p.finMs =
				i + 1 < turnoPalabras.length ? turnoPalabras[i + 1].inicioMs : inicioTurno + duracion;
		});
		palabras.push(...turnoPalabras);
	}
	return palabras;
}

/**
 * Une las ventanas en orden. En cada solape busca la secuencia común más larga entre el final
 * de lo acumulado y el comienzo de la ventana nueva; desde ahí se queda con la versión de la
 * ventana nueva, que tiene completas las palabras que la anterior cortó en su borde. Si no hay
 * coincidencia fiable, corta por la mitad del solape.
 */
export function fusionarVentanas(ventanas: VentanaTranscrita[]): Palabra[] {
	const ordenadas = [...ventanas].sort((a, b) => a.inicioMs - b.inicioMs);
	let acumuladas: Palabra[] = [];
	let finAnterior = 0;

	for (const ventana of ordenadas) {
		const nuevas = palabrasDeVentana(ventana);
		const inicioSolape = ventana.inicioMs;
		const finSolape = finAnterior;

		if (acumuladas.length === 0 || inicioSolape >= finSolape) {
			acumuladas = acumuladas.concat(nuevas);
		} else {
			const desdeA = acumuladas.findIndex((p) => p.inicioMs >= inicioSolape - TOLERANCIA_SOLAPE_MS);
			const colaA = desdeA === -1 ? [] : acumuladas.slice(desdeA);
			const cabezaB = nuevas.filter((p) => p.inicioMs <= finSolape + TOLERANCIA_SOLAPE_MS);
			const alineacion = secuenciaComunMasLarga(
				colaA.map((p) => p.norma),
				cabezaB.map((p) => p.norma)
			);

			if (alineacion.largo >= MINIMO_ALINEACION) {
				acumuladas = acumuladas
					.slice(0, desdeA + alineacion.inicioA)
					.concat(nuevas.slice(alineacion.inicioB));
			} else {
				const mitad = (inicioSolape + finSolape) / 2;
				acumuladas = acumuladas
					.filter((p) => p.inicioMs < mitad)
					.concat(nuevas.filter((p) => p.inicioMs >= mitad));
			}
		}
		finAnterior = Math.max(finAnterior, ventana.inicioMs + ventana.duracionMs);
	}
	return acumuladas;
}

/** Subsecuencia contigua común más larga entre dos listas de palabras. */
export function secuenciaComunMasLarga(
	a: string[],
	b: string[]
): { inicioA: number; inicioB: number; largo: number } {
	let mejor = { inicioA: 0, inicioB: 0, largo: 0 };
	let previa = new Array<number>(b.length + 1).fill(0);
	for (let i = 1; i <= a.length; i++) {
		const actual = new Array<number>(b.length + 1).fill(0);
		for (let j = 1; j <= b.length; j++) {
			if (a[i - 1] === b[j - 1]) {
				actual[j] = previa[j - 1] + 1;
				if (actual[j] > mejor.largo) {
					mejor = { inicioA: i - actual[j], inicioB: j - actual[j], largo: actual[j] };
				}
			}
		}
		previa = actual;
	}
	return mejor;
}

/**
 * Agrupa las palabras en fragmentos de `maximoMs` o menos. Prefiere cortar en un final de frase
 * o en una pausa, siempre que el fragmento ya dure al menos `minimoPreferidoMs`.
 */
export function fragmentar(
	palabras: Palabra[],
	maximoMs = 20_000,
	minimoPreferidoMs = 8_000,
	pausaMs = 1_200
): Fragmento[] {
	const fragmentos: Fragmento[] = [];
	let actual: Palabra[] = [];

	const cerrar = () => {
		if (actual.length === 0) return;
		fragmentos.push({
			inicioMs: actual[0].inicioMs,
			finMs: actual[actual.length - 1].finMs,
			texto: actual.map((p) => p.texto).join(' ')
		});
		actual = [];
	};

	for (const palabra of palabras) {
		if (actual.length > 0) {
			const primera = actual[0];
			const ultima = actual[actual.length - 1];
			const duracionConPalabra = palabra.finMs - primera.inicioMs;
			const duracionActual = ultima.finMs - primera.inicioMs;
			const finDeFrase = /[.!?…]["»”)]?$/.test(ultima.texto);
			const hayPausa = palabra.inicioMs - ultima.finMs >= pausaMs;
			if (
				duracionConPalabra > maximoMs ||
				(duracionActual >= minimoPreferidoMs && (finDeFrase || hayPausa))
			) {
				cerrar();
			}
		}
		actual.push(palabra);
	}
	cerrar();
	return fragmentos;
}
