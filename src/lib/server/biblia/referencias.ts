import { normalizar } from '../texto/normalizar';
import { CANON } from './canon';

/**
 * Detección de referencias bíblicas en español (design.md D8). Dos entradas:
 * - lo dicho, en la transcripción («Santiago capítulo uno… en el versículo dos dice»);
 * - lo escrito en pantalla («Deuteronomio 6:6-9; 11:18-20»).
 * Toda referencia se valida contra el canon: lo imposible (Santiago 9:4) se descarta.
 */

export interface Referencia {
	libro: string;
	capitulo: number;
	versiculoInicio: number | null;
	versiculoFin: number | null;
}

export interface ReferenciaDicha extends Referencia {
	fragmentoId: number;
	momentoMs: number;
}

// ── Libros y sus formas habladas ────────────────────────────────────────────────────────────

const ORDINALES: Record<string, number> = {
	'1': 1,
	primera: 1,
	primero: 1,
	primer: 1,
	i: 1,
	'2': 2,
	segunda: 2,
	segundo: 2,
	ii: 2,
	'3': 3,
	tercera: 3,
	tercero: 3,
	tercer: 3,
	iii: 3
};

/** Formas habladas de cada libro (ya normalizadas), sin el ordinal. */
const FORMAS: Record<string, string[]> = {
	Génesis: ['genesis'],
	Éxodo: ['exodo'],
	Levítico: ['levitico'],
	Números: ['numeros'],
	Deuteronomio: ['deuteronomio'],
	Josué: ['josue'],
	Jueces: ['jueces'],
	Rut: ['rut', 'ruth'],
	Samuel: ['samuel'],
	Reyes: ['reyes'],
	Crónicas: ['cronicas'],
	Esdras: ['esdras'],
	Nehemías: ['nehemias'],
	Ester: ['ester'],
	Job: ['job'],
	Salmos: ['salmos', 'salmo'],
	Proverbios: ['proverbios'],
	Eclesiastés: ['eclesiastes'],
	Cantares: ['cantares', 'cantar de los cantares'],
	Isaías: ['isaias'],
	Jeremías: ['jeremias'],
	Lamentaciones: ['lamentaciones'],
	Ezequiel: ['ezequiel'],
	Daniel: ['daniel'],
	Oseas: ['oseas'],
	Joel: ['joel'],
	Amós: ['amos'],
	Abdías: ['abdias'],
	Jonás: ['jonas'],
	Miqueas: ['miqueas'],
	Nahúm: ['nahum'],
	Habacuc: ['habacuc'],
	Sofonías: ['sofonias'],
	Hageo: ['hageo'],
	Zacarías: ['zacarias'],
	Malaquías: ['malaquias'],
	Mateo: ['mateo', 'evangelio de mateo', 'evangelio segun mateo'],
	Marcos: ['marcos', 'evangelio de marcos', 'evangelio segun marcos'],
	Lucas: ['lucas', 'evangelio de lucas', 'evangelio segun lucas'],
	Juan: ['juan', 'evangelio de juan', 'evangelio segun juan'],
	Hechos: ['hechos', 'hechos de los apostoles'],
	Romanos: ['romanos', 'carta a los romanos', 'epistola a los romanos'],
	Corintios: ['corintios', 'a los corintios', 'carta a los corintios'],
	Gálatas: ['galatas', 'a los galatas', 'carta a los galatas'],
	Efesios: ['efesios', 'a los efesios', 'carta a los efesios'],
	Filipenses: ['filipenses', 'a los filipenses', 'carta a los filipenses'],
	Colosenses: ['colosenses', 'a los colosenses', 'carta a los colosenses'],
	Tesalonicenses: ['tesalonicenses', 'a los tesalonicenses'],
	Timoteo: ['timoteo', 'a timoteo'],
	Tito: ['tito', 'a tito'],
	Filemón: ['filemon', 'a filemon'],
	Hebreos: ['hebreos', 'a los hebreos', 'carta a los hebreos'],
	Santiago: ['santiago'],
	Pedro: ['pedro', 'de pedro'],
	Judas: ['judas'],
	Apocalipsis: ['apocalipsis']
};

/** Libros que existen en varias partes: «1 Samuel», «2 Corintios», «3 Juan»… */
const NUMERADOS = new Set(
	CANON.filter((l) => /^\d /.test(l.nombre)).map((l) => l.nombre.replace(/^\d /, ''))
);

const POR_NOMBRE = new Map(CANON.map((l) => [l.nombre, l]));

interface Forma {
	palabras: string[];
	base: string;
}

/** Formas ordenadas de la más larga a la más corta, para que gane la coincidencia más completa. */
const TODAS_LAS_FORMAS: Forma[] = Object.entries(FORMAS)
	.flatMap(([base, formas]) => formas.map((f) => ({ palabras: f.split(' '), base })))
	.sort((a, b) => b.palabras.length - a.palabras.length);

// ── Números en palabras ─────────────────────────────────────────────────────────────────────

const UNIDADES: Record<string, number> = {
	cero: 0,
	un: 1,
	uno: 1,
	una: 1,
	dos: 2,
	tres: 3,
	cuatro: 4,
	cinco: 5,
	seis: 6,
	siete: 7,
	ocho: 8,
	nueve: 9,
	diez: 10,
	once: 11,
	doce: 12,
	trece: 13,
	catorce: 14,
	quince: 15,
	dieciseis: 16,
	diecisiete: 17,
	dieciocho: 18,
	diecinueve: 19,
	veinte: 20,
	veintiun: 21,
	veintiuno: 21,
	veintiuna: 21,
	veintidos: 22,
	veintitres: 23,
	veinticuatro: 24,
	veinticinco: 25,
	veintiseis: 26,
	veintisiete: 27,
	veintiocho: 28,
	veintinueve: 29
};
const DECENAS: Record<string, number> = {
	treinta: 30,
	cuarenta: 40,
	cincuenta: 50,
	sesenta: 60,
	setenta: 70,
	ochenta: 80,
	noventa: 90
};

/**
 * Lee un número (en cifras o en palabras, hasta 199) desde la posición `i`.
 * Devuelve el valor y cuántas palabras ocupó, o `null`.
 */
export function leerNumero(palabras: string[], i: number): { valor: number; largo: number } | null {
	const p = palabras[i];
	if (p === undefined) return null;
	if (/^\d{1,3}$/.test(p)) return { valor: Number(p), largo: 1 };
	let valor = 0;
	let j = i;
	if (palabras[j] === 'cien' || palabras[j] === 'ciento') {
		valor = 100;
		j++;
		if (palabras[i] === 'cien') return { valor, largo: 1 };
	}
	if (DECENAS[palabras[j]] !== undefined) {
		valor += DECENAS[palabras[j]];
		j++;
		if (
			palabras[j] === 'y' &&
			UNIDADES[palabras[j + 1]] !== undefined &&
			UNIDADES[palabras[j + 1]] < 10
		) {
			valor += UNIDADES[palabras[j + 1]];
			j += 2;
		}
	} else if (UNIDADES[palabras[j]] !== undefined) {
		valor += UNIDADES[palabras[j]];
		j++;
	}
	return j > i && valor > 0 ? { valor, largo: j - i } : null;
}

// ── Validación contra el canon ──────────────────────────────────────────────────────────────

/** Devuelve la referencia con el nombre canónico, o `null` si no puede existir. */
export function validar(r: Referencia): Referencia | null {
	const libro = POR_NOMBRE.get(r.libro);
	if (!libro) return null;
	const versiculos = libro.versiculos[r.capitulo - 1];
	if (!versiculos || r.capitulo < 1) return null;
	const { versiculoInicio: vi, versiculoFin: vf } = r;
	if (vi !== null && (vi < 1 || vi > versiculos)) return null;
	if (vf !== null && (vi === null || vf < vi || vf > versiculos)) return null;
	return r;
}

// ── Lo dicho ────────────────────────────────────────────────────────────────────────────────

interface Palabra {
	texto: string;
	fragmento: number;
}

/**
 * Libros cuyo nombre también es un nombre de persona o una palabra común («Juan dos veces»,
 * «Daniel tres años», «los hechos dos»). Para ellos se exige la palabra «capítulo» o un versículo.
 */
const AMBIGUOS = new Set([
	'Juan',
	'Daniel',
	'Lucas',
	'Marcos',
	'Mateo',
	'Santiago',
	'Job',
	'Hechos',
	'Rut',
	'Tito',
	'Judas',
	'Ester',
	'Joel',
	'Amós',
	'Jonás',
	'Samuel',
	'Pedro',
	'Oseas',
	'Esdras'
]);

/** Palabras que pueden ir entre el número de capítulo y el de versículo. */
const ANTES_DE_VERSICULO = /^(versiculo|versiculos|verso|versos)$/;
/** Ventana (en palabras) para unir «Santiago capítulo uno» con el «versículo dos» que llega después. */
const VENTANA_VERSICULO = 60;
/** Palabras de relleno que pueden ir entre el libro y «capítulo» («Santiago, en el capítulo uno»). */
const RELLENO = new Set(['en', 'el', 'la', 'de', 'eh', 'em', 'este']);
/**
 * Un «versículo N» suelto se refiere al último libro y capítulo citados si fue hace menos de
 * esto y no se nombró otro libro en medio («…en el versículo doce dice Santiago…»).
 */
const CONTEXTO_MS = 15 * 60_000;

/**
 * Busca referencias habladas en los fragmentos de un video. La referencia se registra en el
 * momento en que se nombra el libro. Si después de «libro capítulo N» llega, dentro de unas pocas
 * frases, «versículo M», se unen en una sola referencia. Exige siempre un número de capítulo
 * tras el libro: «Santiago» o «Hechos» solos no son pasajes.
 */
export function detectarDichas(
	fragmentos: Array<{ id: number; inicioMs: number; texto: string }>
): ReferenciaDicha[] {
	const palabras: Palabra[] = fragmentos.flatMap((f, i) =>
		normalizar(f.texto)
			.split(' ')
			.filter(Boolean)
			.map((texto) => ({ texto, fragmento: i }))
	);
	const textos = palabras.map((p) => p.texto);
	const momento = (indice: number) => fragmentos[palabras[indice].fragmento];
	const encontradas: ReferenciaDicha[] = [];
	/** Posiciones de «versículo N» ya usados por una referencia, para no contarlos dos veces. */
	const usados = new Set<number>();
	/** Última referencia y dónde se nombró un libro por última vez, para el contexto. */
	let contexto: { libro: string; capitulo: number; inicioMs: number } | null = null;

	const registrar = (r: Referencia, indice: number) => {
		const valida = validar(r);
		if (!valida) return false;
		const f = momento(indice);
		encontradas.push({ ...valida, fragmentoId: f.id, momentoMs: f.inicioMs });
		contexto = { libro: valida.libro, capitulo: valida.capitulo, inicioMs: f.inicioMs };
		return true;
	};

	for (let i = 0; i < textos.length; i++) {
		const libro = leerLibro(textos, i);
		if (!libro) {
			// «versículo N» suelto: se asigna al libro y capítulo en contexto.
			if (ANTES_DE_VERSICULO.test(textos[i]) && !usados.has(i) && contexto) {
				const numero = leerNumero(textos, saltarRelleno(textos, i + 1));
				const enContexto = contexto as { libro: string; capitulo: number; inicioMs: number };
				const ultima = encontradas.at(-1);
				const yaContada =
					numero &&
					ultima?.libro === enContexto.libro &&
					ultima.capitulo === enContexto.capitulo &&
					ultima.versiculoInicio === numero.valor &&
					momento(i).inicioMs - ultima.momentoMs < 60_000;
				if (numero && !yaContada && momento(i).inicioMs - enContexto.inicioMs <= CONTEXTO_MS) {
					const inicioNumero = saltarRelleno(textos, i + 1);
					registrar(
						{
							libro: enContexto.libro,
							capitulo: enContexto.capitulo,
							versiculoInicio: numero.valor,
							versiculoFin: leerFinDeRango(textos, inicioNumero + numero.largo)
						},
						i
					);
					usados.add(i);
				}
			}
			continue;
		}

		// Nombrar otro libro sin capítulo también rompe el contexto anterior.
		const contextoPrevio = contexto as { libro: string } | null;
		if (contextoPrevio && contextoPrevio.libro !== libro.nombre) contexto = null;

		let j = libro.fin;
		let saltados = 0;
		while (RELLENO.has(textos[j]) && saltados < 3) {
			j++;
			saltados++;
		}
		const dijoCapitulo = textos[j] === 'capitulo' || textos[j] === 'capitulos';
		if (dijoCapitulo) j++;
		else if (saltados > 0) continue; // «Santiago en el…» sin «capítulo» no es una cita
		const capitulo = leerNumero(textos, j);
		if (!capitulo) continue;
		j += capitulo.largo;

		// Versículo: inmediato («Santiago 1 2», «capítulo uno versículo dos») o unas frases después.
		let versiculo: { inicio: number; fin: number | null } | null = null;
		const inmediato = leerNumero(textos, j);
		if (inmediato && !ANTES_DE_VERSICULO.test(textos[j] ?? '')) {
			versiculo = { inicio: inmediato.valor, fin: leerFinDeRango(textos, j + inmediato.largo) };
		} else {
			for (let k = j; k < Math.min(j + VENTANA_VERSICULO, textos.length); k++) {
				const otro = k > j ? leerLibro(textos, k) : null;
				if (otro && otro.nombre !== libro.nombre) break; // empezó otra referencia
				if (!ANTES_DE_VERSICULO.test(textos[k])) continue;
				const inicioNumero = saltarRelleno(textos, k + 1);
				const numero = leerNumero(textos, inicioNumero);
				if (numero) {
					versiculo = {
						inicio: numero.valor,
						fin: leerFinDeRango(textos, inicioNumero + numero.largo)
					};
					usados.add(k);
				}
				break;
			}
		}

		const base = libro.nombre.replace(/^\d /, '');
		if (AMBIGUOS.has(base) && !dijoCapitulo && !versiculo) continue;

		const anterior = encontradas.at(-1);
		const repetida =
			anterior &&
			anterior.libro === libro.nombre &&
			anterior.capitulo === capitulo.valor &&
			momento(i).inicioMs - anterior.momentoMs < 60_000;
		if (repetida && (anterior.versiculoInicio !== null || !versiculo)) {
			// «…Filipenses, en el capítulo cuatro, Filipenses capítulo cuatro…»: la misma cita
			// repetida en voz alta se cuenta una vez, en el momento en que se nombró primero.
			i = j - 1;
			continue;
		}
		if (repetida && versiculo) {
			// La repetición trae el versículo que faltaba: se completa la primera.
			const completada = validar({
				...anterior,
				versiculoInicio: versiculo.inicio,
				versiculoFin: versiculo.fin
			});
			if (completada) Object.assign(anterior, completada);
			i = j - 1;
			continue;
		}

		registrar(
			{
				libro: libro.nombre,
				capitulo: capitulo.valor,
				versiculoInicio: versiculo?.inicio ?? null,
				versiculoFin: versiculo?.fin ?? null
			},
			i
		);
		i = j - 1;
	}
	return encontradas;
}

function saltarRelleno(textos: string[], i: number): number {
	let j = i;
	while (j < i + 2 && (textos[j] === 'eh' || textos[j] === 'em' || textos[j] === 'el')) j++;
	return j;
}

/** «al cinco», «a 9», «hasta el doce» tras el primer versículo. «dos y doce» son dos versículos. */
function leerFinDeRango(textos: string[], i: number): number | null {
	let j = i;
	if (textos[j] === 'al' || textos[j] === 'a') j++;
	else if (textos[j] === 'hasta') j += textos[j + 1] === 'el' ? 2 : 1;
	else return null;
	return leerNumero(textos, j)?.valor ?? null;
}

/** Reconoce un libro (con su ordinal, si es de los numerados) que empieza en `i`. */
function leerLibro(textos: string[], i: number): { nombre: string; fin: number } | null {
	let ordinal: number | null = null;
	let j = i;
	if (ORDINALES[textos[j]] !== undefined) {
		ordinal = ORDINALES[textos[j]];
		j++;
		// «primera de Juan», «segunda a los Corintios», «primer libro de los Reyes»
		while (['de', 'a', 'carta', 'epistola', 'libro', 'los', 'la'].includes(textos[j])) j++;
	}
	for (const forma of TODAS_LAS_FORMAS) {
		const coincide = forma.palabras.every((p, k) => textos[j + k] === p);
		if (!coincide) continue;
		const fin = j + forma.palabras.length;
		if (NUMERADOS.has(forma.base)) {
			// Juan y Pedro… sin ordinal son el evangelio o no son libro; con ordinal, la carta.
			if (ordinal !== null) return { nombre: `${ordinal} ${forma.base}`, fin };
			if (forma.base === 'Juan') return { nombre: 'Juan', fin };
			return null;
		}
		if (ordinal !== null) return null;
		return { nombre: forma.base, fin };
	}
	return null;
}

// ── Lo escrito en pantalla ──────────────────────────────────────────────────────────────────

/**
 * Referencias escritas («Deuteronomio 6:6-9; 11:18-20», «1 Juan 4:8», «Salmo 23»). Un libro puede
 * ir seguido de varias referencias separadas por punto y coma, que heredan el libro.
 */
export function detectarEscritas(texto: string): Referencia[] {
	const encontradas: Referencia[] = [];
	const nombres = TODAS_LAS_FORMAS.map((f) => f.palabras.join('\\s+')).join('|');
	const patron = new RegExp(
		`(?:\\b([123]|i{1,3})\\s*)?\\b(${nombres})\\.?\\s+((?:\\d{1,3}(?::\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)?\\s*[;,]?\\s*)+)`,
		'gi'
	);
	for (const m of sinTildes(texto).matchAll(patron)) {
		const ordinal = m[1] ? (ORDINALES[m[1].toLowerCase()] ?? null) : null;
		const forma = TODAS_LAS_FORMAS.find(
			(f) => f.palabras.join(' ') === m[2].toLowerCase().replace(/\s+/g, ' ')
		);
		if (!forma) continue;
		const nombre = NUMERADOS.has(forma.base)
			? ordinal !== null
				? `${ordinal} ${forma.base}`
				: forma.base === 'Juan'
					? 'Juan'
					: null
			: forma.base;
		if (!nombre) continue;
		for (const parte of m[3].split(/[;,]/)) {
			const r = /(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?/.exec(parte);
			if (!r) continue;
			const valida = validar({
				libro: nombre,
				capitulo: Number(r[1]),
				versiculoInicio: r[2] ? Number(r[2]) : null,
				versiculoFin: r[3] ? Number(r[3]) : null
			});
			if (valida) encontradas.push(valida);
		}
	}
	return encontradas;
}

/** Quita tildes pero conserva signos (dos puntos, guiones) para leer referencias escritas. */
function sinTildes(texto: string): string {
	return texto
		.normalize('NFD')
		.replace(/\p{Mn}/gu, '')
		.normalize('NFC');
}

/** «Santiago 1:2», «Deuteronomio 6:6-9», «Salmos 23». */
export function formatoReferencia(r: Referencia): string {
	if (r.versiculoInicio === null) return `${r.libro} ${r.capitulo}`;
	const fin =
		r.versiculoFin !== null && r.versiculoFin !== r.versiculoInicio ? `-${r.versiculoFin}` : '';
	return `${r.libro} ${r.capitulo}:${r.versiculoInicio}${fin}`;
}
