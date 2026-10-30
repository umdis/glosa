import { error } from '@sveltejs/kit';
import { folio } from '#lib/formato.js';
import { claveLamina, type PedidoLamina } from '#lib/server/laminas/lamina.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import { crearVerificador } from '#lib/server/verificacion/verificar.js';

/**
 * Lo que lleva la lámina de una cita. La frase de `?q=` se verifica contra la transcripción como
 * cualquier cita: una lámina nunca puede poner en boca de nadie algo que no dijo. Sin `?q=`, la
 * lámina lleva el fragmento entero.
 */
export function pedidoLamina(
	fragmento: string,
	url: URL
): PedidoLamina & {
	fragmentoId: number;
	videoId: string;
	titulo: string;
	inicioMs: number;
} {
	const id = Number(fragmento);
	if (!Number.isInteger(id)) error(404, 'Card not found');
	const { db } = obtenerServicios();
	const fila = db
		.prepare(
			`SELECT f.texto FROM fragmentos f JOIN videos v ON v.id = f.video_id
			 WHERE f.id = ? AND f.visibilidad = 'visible' AND v.estado = 'listo'`
		)
		.get(id) as { texto: string } | undefined;
	if (!fila) error(404, 'This moment cannot be made into a card.');

	const pedida = (url.searchParams.get('q') ?? fila.texto)
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 300);
	const cita = crearVerificador(db)({ fragmentoId: id, frase: pedida });
	if (cita.estado !== 'verificada') error(404, 'That quote is not in the transcript.');

	return {
		clave: claveLamina(cita.fragmentoId, cita.frase),
		frase: cita.frase,
		fuente: `${cita.titulo}, ¶ ${folio(cita.inicioMs)}`,
		enlace: `${url.origin}/videos/${cita.videoId}?t=${Math.floor(cita.inicioMs / 1000)}#f-${cita.fragmentoId}`,
		fragmentoId: cita.fragmentoId,
		videoId: cita.videoId,
		titulo: cita.titulo,
		inicioMs: cita.inicioMs
	};
}
