import { createHash } from 'node:crypto';
import type { Base } from '../db/base';
import { rutaLamina, type PedidoLamina } from '../laminas/lamina';

/**
 * Portada de una investigación publicada (spec laminas-ilustradas, tarea 4.4): la misma lámina
 * que la de una cita, con el título de la investigación en lugar de la frase, la cuenta de citas
 * verificadas como fuente y un QR a la página de lectura. La clave cambia si cambia el título,
 * así que una portada vieja no se sirve con un título nuevo.
 */
export function pedidoPortada(
	db: Base,
	investigacion: { id: string; titulo: string },
	origen: string
): PedidoLamina {
	const { citas } = db
		.prepare(
			`SELECT count(*) AS citas FROM bloques
			 WHERE investigacion_id = ? AND tipo = 'cita' AND fragmento_id IS NOT NULL`
		)
		.get(investigacion.id) as { citas: number };
	const titulo = investigacion.titulo.trim() || 'An investigation';
	return {
		clave: `portada-${investigacion.id}-${createHash('sha256').update(titulo).digest('hex').slice(0, 16)}`,
		frase: titulo,
		fuente: `${citas} verified ${citas === 1 ? 'quote' : 'quotes'} from video`,
		enlace: `${origen}/investigations/${investigacion.id}`,
		pie: 'An investigation with verified quotes, scan to read it.  Illustration: Muse Image.  glosa.umdis.site',
		cita: false
	};
}

export const rutaPortada = (carpeta: string, pedido: PedidoLamina) =>
	rutaLamina(carpeta, pedido.clave);
