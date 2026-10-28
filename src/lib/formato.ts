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

/** Un carácter sin tildes ni mayúsculas, para comparar como lo haría alguien que busca. */
function plegar(caracter: string): string {
	return caracter.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Si `texto` contiene `consulta` sin importar tildes ni mayúsculas. */
export function contiene(texto: string, consulta: string): boolean {
	const q = [...consulta.trim()].map(plegar).join('');
	return q !== '' && [...texto].map(plegar).join('').includes(q);
}

/**
 * Parte `texto` en tramos, marcando cada aparición de `consulta` sin importar tildes ni
 * mayúsculas. Los tramos conservan el texto original («tentación» resalta al buscar «tentacion»).
 */
export function resaltar(
	texto: string,
	consulta: string
): Array<{ texto: string; marca: boolean }> {
	const q = [...consulta.trim()].map(plegar).join('');
	if (!q) return [{ texto, marca: false }];
	const caracteres = [...texto];
	// Para cada carácter plegado, la posición del carácter original del que viene.
	let plegado = '';
	const origen: number[] = [];
	caracteres.forEach((c, i) => {
		for (const p of plegar(c)) {
			plegado += p;
			origen.push(i);
		}
	});
	const tramos: Array<{ texto: string; marca: boolean }> = [];
	let desde = 0;
	for (let i = plegado.indexOf(q); i !== -1; i = plegado.indexOf(q, i + q.length)) {
		const inicio = origen[i];
		const fin = origen[i + q.length - 1] + 1;
		if (inicio > desde)
			tramos.push({ texto: caracteres.slice(desde, inicio).join(''), marca: false });
		tramos.push({ texto: caracteres.slice(inicio, fin).join(''), marca: true });
		desde = fin;
	}
	if (desde < caracteres.length)
		tramos.push({ texto: caracteres.slice(desde).join(''), marca: false });
	return tramos;
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
