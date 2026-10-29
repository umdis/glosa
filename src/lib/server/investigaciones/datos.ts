import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Base } from '../db/base';
import { crearVerificador } from '../verificacion/verificar';

/**
 * Investigaciones (spec investigaciones; design.md D1–D2 de glosa-competitiva): un cuaderno de
 * bloques sin cuentas. Quien la crea recibe un secreto de edición; aquí solo se guarda su resumen.
 */

export type TipoBloque = 'titulo' | 'texto' | 'cita' | 'nota';
export const TIPOS_BLOQUE: TipoBloque[] = ['titulo', 'texto', 'cita', 'nota'];

export const LIMITES = {
	titulo: 120,
	texto: 4000,
	bloques: 150
} as const;

export interface Investigacion {
	id: string;
	titulo: string;
	publicada: boolean;
	retirada: boolean;
	actualizadaEn: string;
}

export type Bloque =
	| {
			id: number;
			orden: number;
			tipo: 'titulo' | 'texto' | 'nota';
			texto: string;
			origenIa: boolean;
	  }
	| {
			id: number;
			orden: number;
			tipo: 'cita';
			origenIa: boolean;
			/** null si el fragmento ya no es visible o se borró: la cita está retirada. */
			cita: {
				frase: string;
				fragmentoId: number;
				videoId: string;
				titulo: string;
				inicioMs: number;
			} | null;
	  };

export class ErrorInvestigacion extends Error {}

const resumen = (secreto: string) =>
	createHash('sha256').update(`glosa-investigacion:${secreto}`).digest('hex');

/** Identificador corto y legible en una URL (10 caracteres en base32 sin ambigüedades). */
function nuevoId(): string {
	const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
	return [...randomBytes(10)].map((b) => alfabeto[b % alfabeto.length]).join('');
}

function limpiarTitulo(titulo: string): string {
	const limpio = titulo.replace(/\s+/g, ' ').trim();
	if (!limpio) throw new ErrorInvestigacion('Give the investigation a title.');
	if (limpio.length > LIMITES.titulo)
		throw new ErrorInvestigacion(`Keep the title under ${LIMITES.titulo} characters.`);
	return limpio;
}

function limpiarTexto(texto: string): string {
	const limpio = texto.replace(/\r\n/g, '\n').trim();
	if (!limpio) throw new ErrorInvestigacion('Write something in the block first.');
	if (limpio.length > LIMITES.texto)
		throw new ErrorInvestigacion(`Keep each block under ${LIMITES.texto} characters.`);
	return limpio;
}

/** Crea la investigación y devuelve su secreto de edición, que no se vuelve a poder leer. */
export function crearInvestigacion(db: Base, titulo: string): { id: string; secreto: string } {
	const id = nuevoId();
	const secreto = randomBytes(32).toString('base64url');
	db.prepare(`INSERT INTO investigaciones (id, titulo, secreto_hash) VALUES (?, ?, ?)`).run(
		id,
		limpiarTitulo(titulo),
		resumen(secreto)
	);
	return { id, secreto };
}

/** Comprueba el secreto de edición en tiempo constante. */
export function puedeEditar(db: Base, id: string, secreto: string | undefined): boolean {
	if (!secreto) return false;
	const fila = db.prepare(`SELECT secreto_hash FROM investigaciones WHERE id = ?`).get(id) as
		{ secreto_hash: string } | undefined;
	if (!fila) return false;
	return timingSafeEqual(
		Buffer.from(resumen(secreto), 'hex'),
		Buffer.from(fila.secreto_hash, 'hex')
	);
}

export function obtenerInvestigacion(db: Base, id: string): Investigacion | undefined {
	const fila = db
		.prepare(
			`SELECT id, titulo, publicada, retirada, actualizada_en FROM investigaciones WHERE id = ?`
		)
		.get(id) as
		| { id: string; titulo: string; publicada: number; retirada: number; actualizada_en: string }
		| undefined;
	if (!fila) return undefined;
	return {
		id: fila.id,
		titulo: fila.titulo,
		publicada: fila.publicada === 1 && fila.retirada === 0,
		retirada: fila.retirada === 1,
		actualizadaEn: fila.actualizada_en
	};
}

/** Títulos de varias investigaciones, en el orden pedido (las inexistentes se omiten). */
export function titulosDe(db: Base, ids: string[]): Array<{ id: string; titulo: string }> {
	if (ids.length === 0) return [];
	const filas = db
		.prepare(`SELECT id, titulo FROM investigaciones WHERE id IN (${ids.map(() => '?').join(',')})`)
		.all(...ids) as Array<{ id: string; titulo: string }>;
	const porId = new Map(filas.map((f) => [f.id, f]));
	return ids.flatMap((i) => (porId.has(i) ? [porId.get(i)!] : []));
}

interface FilaBloque {
	id: number;
	orden: number;
	tipo: TipoBloque;
	texto: string;
	origen_ia: number;
	fragmento_id: number | null;
	video_id: string | null;
	titulo_video: string | null;
	inicio_ms: number | null;
	visible: number | null;
}

/**
 * Bloques en orden. El texto de una cita solo se entrega si su fragmento sigue visible y su video
 * sigue publicado: lo que se oculta después de citarlo deja de salir por aquí.
 */
export function bloquesDe(db: Base, id: string): Bloque[] {
	const filas = db
		.prepare(
			`SELECT b.id, b.orden, b.tipo, b.texto, b.origen_ia, b.fragmento_id,
			        f.video_id, v.titulo AS titulo_video, f.inicio_ms,
			        (f.visibilidad = 'visible' AND v.archivo_reproduccion IS NOT NULL) AS visible
			 FROM bloques b
			 LEFT JOIN fragmentos f ON f.id = b.fragmento_id
			 LEFT JOIN videos v ON v.id = f.video_id
			 WHERE b.investigacion_id = ?
			 ORDER BY b.orden, b.id`
		)
		.all(id) as FilaBloque[];
	return filas.map((f): Bloque => {
		const origenIa = f.origen_ia === 1;
		if (f.tipo !== 'cita')
			return { id: f.id, orden: f.orden, tipo: f.tipo, texto: f.texto, origenIa };
		const disponible = f.visible === 1 && f.fragmento_id !== null && f.video_id !== null;
		return {
			id: f.id,
			orden: f.orden,
			tipo: 'cita',
			origenIa,
			cita: disponible
				? {
						frase: f.texto,
						fragmentoId: f.fragmento_id!,
						videoId: f.video_id!,
						titulo: f.titulo_video!,
						inicioMs: f.inicio_ms!
					}
				: null
		};
	});
}

function tocar(db: Base, id: string): void {
	db.prepare(`UPDATE investigaciones SET actualizada_en = datetime('now') WHERE id = ?`).run(id);
}

function exigirCupo(db: Base, id: string, cuantos = 1): void {
	const { n } = db
		.prepare(`SELECT count(*) AS n FROM bloques WHERE investigacion_id = ?`)
		.get(id) as {
		n: number;
	};
	if (n + cuantos > LIMITES.bloques)
		throw new ErrorInvestigacion(`An investigation can hold up to ${LIMITES.bloques} blocks.`);
}

function siguienteOrden(db: Base, id: string): number {
	const { maximo } = db
		.prepare(`SELECT coalesce(max(orden), 0) AS maximo FROM bloques WHERE investigacion_id = ?`)
		.get(id) as { maximo: number };
	return maximo + 1;
}

export function renombrar(db: Base, id: string, titulo: string): void {
	db.prepare(`UPDATE investigaciones SET titulo = ? WHERE id = ?`).run(limpiarTitulo(titulo), id);
	tocar(db, id);
}

/** Añade un bloque de texto al final. */
export function anadirTexto(
	db: Base,
	id: string,
	tipo: 'titulo' | 'texto' | 'nota',
	texto: string,
	origenIa = false
): number {
	exigirCupo(db, id);
	const limpio = tipo === 'titulo' ? limpiarTitulo(texto) : limpiarTexto(texto);
	const { lastInsertRowid } = db
		.prepare(
			`INSERT INTO bloques (investigacion_id, orden, tipo, texto, origen_ia) VALUES (?, ?, ?, ?, ?)`
		)
		.run(id, siguienteOrden(db, id), tipo, limpio, origenIa ? 1 : 0);
	tocar(db, id);
	return Number(lastInsertRowid);
}

/**
 * Añade una cita al final. Solo admite fragmentos visibles de videos publicados. La frase viene de
 * un formulario, así que se vuelve a verificar contra la transcripción: nadie puede guardar como
 * cita algo que no se dijo. Sin frase, la cita es el fragmento entero. La IA puede repetir una
 * cita que ya está (un borrador las ordena de nuevo); una persona, no.
 */
export function anadirCita(
	db: Base,
	id: string,
	fragmentoId: number,
	frase: string,
	origenIa = false
): number {
	exigirCupo(db, id);
	const buscar = db.prepare(
		`SELECT f.texto FROM fragmentos f JOIN videos v ON v.id = f.video_id
		 WHERE f.id = ? AND f.visibilidad = 'visible' AND v.archivo_reproduccion IS NOT NULL`
	);
	const fragmento = buscar.get(fragmentoId) as { texto: string } | undefined;
	if (!fragmento) throw new ErrorInvestigacion('That quote is no longer available.');
	let texto = frase.replace(/\s+/g, ' ').trim();
	if (texto) {
		if (texto.length > LIMITES.texto) throw new ErrorInvestigacion('That quote is too long.');
		const verificada = crearVerificador(db)({ fragmentoId, frase: texto });
		if (verificada.estado !== 'verificada')
			throw new ErrorInvestigacion('That quote does not match the transcript.');
		// El minuto es el del fragmento donde empieza la frase, que puede ser el vecino.
		fragmentoId = verificada.fragmentoId;
	} else {
		texto = fragmento.texto;
	}
	if (!origenIa) {
		const repetida = db
			.prepare(
				`SELECT 1 FROM bloques WHERE investigacion_id = ? AND fragmento_id = ? AND texto = ?`
			)
			.get(id, fragmentoId, texto);
		if (repetida) throw new ErrorInvestigacion('That quote is already in this investigation.');
	}
	const { lastInsertRowid } = db
		.prepare(
			`INSERT INTO bloques (investigacion_id, orden, tipo, texto, fragmento_id, origen_ia)
			 VALUES (?, ?, 'cita', ?, ?, ?)`
		)
		.run(id, siguienteOrden(db, id), texto, fragmentoId, origenIa ? 1 : 0);
	tocar(db, id);
	return Number(lastInsertRowid);
}

/** Cambia el texto de un bloque que no es cita. Deja de contar como redactado por la IA. */
export function editarBloque(db: Base, id: string, bloqueId: number, texto: string): void {
	const fila = db
		.prepare(`SELECT tipo FROM bloques WHERE id = ? AND investigacion_id = ?`)
		.get(bloqueId, id) as { tipo: TipoBloque } | undefined;
	if (!fila) throw new ErrorInvestigacion('That block no longer exists.');
	if (fila.tipo === 'cita') throw new ErrorInvestigacion('Quotes cannot be edited.');
	const limpio = fila.tipo === 'titulo' ? limpiarTitulo(texto) : limpiarTexto(texto);
	db.prepare(`UPDATE bloques SET texto = ?, origen_ia = 0 WHERE id = ?`).run(limpio, bloqueId);
	tocar(db, id);
}

export function borrarBloque(db: Base, id: string, bloqueId: number): void {
	db.prepare(`DELETE FROM bloques WHERE id = ? AND investigacion_id = ?`).run(bloqueId, id);
	tocar(db, id);
}

/**
 * Sube o baja un bloque una posición. Devuelve la nueva posición (desde 1) y el total, para
 * anunciarlo; si ya está en el extremo, no cambia nada.
 */
export function moverBloque(
	db: Base,
	id: string,
	bloqueId: number,
	direccion: 'arriba' | 'abajo'
): { posicion: number; total: number } {
	return db.transaction(() => {
		const filas = db
			.prepare(`SELECT id, orden FROM bloques WHERE investigacion_id = ? ORDER BY orden, id`)
			.all(id) as Array<{ id: number; orden: number }>;
		const i = filas.findIndex((f) => f.id === bloqueId);
		if (i < 0) throw new ErrorInvestigacion('That block no longer exists.');
		const j = direccion === 'arriba' ? i - 1 : i + 1;
		if (j >= 0 && j < filas.length) {
			[filas[i], filas[j]] = [filas[j], filas[i]];
			const renumerar = db.prepare(`UPDATE bloques SET orden = ? WHERE id = ?`);
			filas.forEach((f, k) => renumerar.run(k + 1, f.id));
			tocar(db, id);
			return { posicion: j + 1, total: filas.length };
		}
		return { posicion: i + 1, total: filas.length };
	})();
}

export function publicar(db: Base, id: string, publicada: boolean): void {
	const fila = obtenerInvestigacion(db, id);
	if (!fila) throw new ErrorInvestigacion('That investigation no longer exists.');
	if (publicada && fila.retirada)
		throw new ErrorInvestigacion(
			'The editor of this collection unpublished it; it cannot be published again.'
		);
	db.prepare(`UPDATE investigaciones SET publicada = ? WHERE id = ?`).run(publicada ? 1 : 0, id);
	tocar(db, id);
}

/** Lo que ve el editor en /admin: las publicadas, para poder retirarlas. */
export function listarPublicadas(db: Base): Array<{ id: string; titulo: string; bloques: number }> {
	return db
		.prepare(
			`SELECT i.id, i.titulo, (SELECT count(*) FROM bloques b WHERE b.investigacion_id = i.id) AS bloques
			 FROM investigaciones i WHERE i.publicada = 1 AND i.retirada = 0
			 ORDER BY i.actualizada_en DESC`
		)
		.all() as Array<{ id: string; titulo: string; bloques: number }>;
}

/** El editor retira una investigación publicada (spec: despublicar desde /admin). */
export function retirar(db: Base, id: string): void {
	db.prepare(`UPDATE investigaciones SET publicada = 0, retirada = 1 WHERE id = ?`).run(id);
}
