/** Minuto de folio: «6:23» o, pasada la hora, «1:02:03». */
export function folio(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Duración legible para el índice: «43 min» o «1 h 9 min». */
export function duracion(ms: number | null | undefined): string {
	if (!ms) return '';
	const minutos = Math.round(ms / 60_000);
	if (minutos < 60) return `${minutos} min`;
	return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

/**
 * Corta un texto alrededor de su primera marca para mostrarlo como concordancia: contexto a la
 * izquierda, la palabra y contexto a la derecha, recortados por palabras completas.
 */
export function concordancia(
	texto: string,
	marcas: Array<[number, number]>,
	alcance = 70
): { antes: string; clave: string; despues: string } {
	if (marcas.length === 0)
		return { antes: '', clave: '', despues: recortarFin(texto, alcance * 2) };
	const [inicio, fin] = marcas[0];
	return {
		antes: recortarInicio(texto.slice(0, inicio), alcance),
		clave: texto.slice(inicio, fin),
		despues: recortarFin(texto.slice(fin), alcance)
	};
}

function recortarInicio(texto: string, alcance: number): string {
	if (texto.length <= alcance) return texto;
	const corte = texto.indexOf(' ', texto.length - alcance);
	return '…' + texto.slice(corte === -1 ? texto.length - alcance : corte + 1);
}

function recortarFin(texto: string, alcance: number): string {
	if (texto.length <= alcance) return texto;
	const corte = texto.lastIndexOf(' ', alcance);
	return texto.slice(0, corte === -1 ? alcance : corte) + '…';
}

interface Pasaje {
	libro: string;
	capitulo: number;
	versiculoInicio: number | null;
	versiculoFin: number | null;
}

/** «1:2», «6:6–9» o solo «6» cuando no se dijo el versículo. */
export function capituloYVersiculo(p: Omit<Pasaje, 'libro'>): string {
	if (p.versiculoInicio === null) return `${p.capitulo}`;
	const fin = p.versiculoFin && p.versiculoFin !== p.versiculoInicio ? `–${p.versiculoFin}` : '';
	return `${p.capitulo}:${p.versiculoInicio}${fin}`;
}

/** «Santiago 1:2». */
export function referencia(p: Pasaje): string {
	return `${p.libro} ${capituloYVersiculo(p)}`;
}
