import { error } from '@sveltejs/kit';
import { folio } from '#lib/formato.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { PageServerLoad } from './$types';

/**
 * «Save to investigation» sin JavaScript: la misma cita que abriría el diálogo, en una página.
 * Solo muestra fragmentos visibles; la frase se vuelve a verificar al guardar.
 */
export const load: PageServerLoad = ({ url }) => {
	const fragmentoId = Number(url.searchParams.get('f'));
	if (!Number.isInteger(fragmentoId)) error(404, 'Quote not found');
	const fila = obtenerServicios()
		.db.prepare(
			`SELECT f.texto, f.inicio_ms, v.titulo FROM fragmentos f JOIN videos v ON v.id = f.video_id
			 WHERE f.id = ? AND f.visibilidad = 'visible' AND v.archivo_reproduccion IS NOT NULL`
		)
		.get(fragmentoId) as { texto: string; inicio_ms: number; titulo: string } | undefined;
	if (!fila) error(404, 'Quote not found');
	return {
		cita: {
			fragmentoId,
			frase: (url.searchParams.get('q') ?? '').slice(0, 1000) || fila.texto,
			etiqueta: `${fila.titulo}, ${folio(fila.inicio_ms)}`
		}
	};
};
