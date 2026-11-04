import { error } from '@sveltejs/kit';
import { obtenerServicios } from '#lib/server/servicios.js';
import { serieCompleta } from '#lib/server/series/series.js';
import { etiquetasDeVideo } from '#lib/server/series/etiquetas.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const { db } = obtenerServicios();
	const serie = serieCompleta(db, params.id);
	if (!serie) error(404, 'That series does not exist.');
	return {
		serie: {
			...serie,
			videos: serie.videos.map((v) => ({ ...v, etiquetas: etiquetasDeVideo(db, v.id) }))
		}
	};
};
