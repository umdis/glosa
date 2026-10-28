import type { Base } from '../db/base';
import { CANON } from './canon';
import type { Referencia, ReferenciaDicha } from './referencias';

/** Reemplaza los pasajes de un origen para un video (reintentar no duplica). */
export function guardarPasajesDichos(db: Base, videoId: string, refs: ReferenciaDicha[]): void {
	const insertar = db.prepare(
		`INSERT INTO pasajes (video_id, libro, capitulo, versiculo_inicio, versiculo_fin, momento_ms, origen, fragmento_id)
		 VALUES (?, ?, ?, ?, ?, ?, 'dicho', ?)`
	);
	db.transaction(() => {
		db.prepare(`DELETE FROM pasajes WHERE video_id = ? AND origen = 'dicho'`).run(videoId);
		for (const r of refs) {
			insertar.run(
				videoId,
				r.libro,
				r.capitulo,
				r.versiculoInicio,
				r.versiculoFin,
				r.momentoMs,
				r.fragmentoId
			);
		}
	})();
}

export function guardarPasajesEnPantalla(
	db: Base,
	videoId: string,
	refs: Array<Referencia & { momentoMs: number }>
): void {
	const insertar = db.prepare(
		`INSERT INTO pasajes (video_id, libro, capitulo, versiculo_inicio, versiculo_fin, momento_ms, origen, fragmento_id)
		 VALUES (?, ?, ?, ?, ?, ?, 'en_pantalla',
			(SELECT id FROM fragmentos WHERE video_id = ? AND inicio_ms <= ? ORDER BY inicio_ms DESC LIMIT 1))`
	);
	db.transaction(() => {
		db.prepare(`DELETE FROM pasajes WHERE video_id = ? AND origen = 'en_pantalla'`).run(videoId);
		for (const r of refs) {
			insertar.run(
				videoId,
				r.libro,
				r.capitulo,
				r.versiculoInicio,
				r.versiculoFin,
				r.momentoMs,
				videoId,
				r.momentoMs
			);
		}
	})();
}

export interface MomentoPasaje {
	videoId: string;
	titulo: string;
	momentoMs: number;
	origen: 'dicho' | 'en_pantalla';
	fragmentoId: number | null;
}

export interface PasajeIndice {
	libro: string;
	capitulo: number;
	versiculoInicio: number | null;
	versiculoFin: number | null;
	momentos: MomentoPasaje[];
}

/**
 * Pasajes de la colección agrupados por libro, en el orden del canon. Un pasaje dicho en un
 * fragmento pendiente u oculto no aparece: el índice público solo muestra lo visible.
 */
export function indicePublico(db: Base): Array<{ libro: string; pasajes: PasajeIndice[] }> {
	const filas = db
		.prepare(
			`SELECT p.libro, p.capitulo, p.versiculo_inicio AS versiculoInicio, p.versiculo_fin AS versiculoFin,
				p.video_id AS videoId, v.titulo, p.momento_ms AS momentoMs, p.origen, p.fragmento_id AS fragmentoId
			 FROM pasajes p
			 JOIN videos v ON v.id = p.video_id
			 LEFT JOIN fragmentos f ON f.id = p.fragmento_id
			 WHERE p.origen = 'en_pantalla' OR f.visibilidad = 'visible'
			 ORDER BY p.capitulo, p.versiculo_inicio, v.titulo, p.momento_ms`
		)
		.all() as Array<Omit<PasajeIndice, 'momentos'> & MomentoPasaje>;

	const orden = new Map(CANON.map((l, i) => [l.nombre, i]));
	const porLibro = new Map<string, Map<string, PasajeIndice>>();
	for (const f of filas) {
		const clave = `${f.capitulo}:${f.versiculoInicio ?? ''}-${f.versiculoFin ?? ''}`;
		const libro = porLibro.get(f.libro) ?? new Map<string, PasajeIndice>();
		const pasaje = libro.get(clave) ?? {
			libro: f.libro,
			capitulo: f.capitulo,
			versiculoInicio: f.versiculoInicio,
			versiculoFin: f.versiculoFin,
			momentos: []
		};
		pasaje.momentos.push({
			videoId: f.videoId,
			titulo: f.titulo,
			momentoMs: f.momentoMs,
			origen: f.origen,
			fragmentoId: f.fragmentoId
		});
		libro.set(clave, pasaje);
		porLibro.set(f.libro, libro);
	}
	return [...porLibro.entries()]
		.sort(([a], [b]) => (orden.get(a) ?? 99) - (orden.get(b) ?? 99))
		.map(([libro, pasajes]) => ({ libro, pasajes: [...pasajes.values()] }));
}
