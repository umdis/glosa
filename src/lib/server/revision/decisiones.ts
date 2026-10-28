import { olvidarRespuestas } from '../agente/limites';
import type { Base } from '../db/base';

export type Decision = 'aprobado' | 'oculto';

export interface ElementoPendiente {
	id: number;
	tipo: 'resumen' | 'temas' | 'fragmento_sensible';
	videoId: string;
	titulo: string;
	fragmentoId: number | null;
	inicioMs: number | null;
	texto: string | null;
	categoria: string | null;
	contenido: string;
}

/** Cola de revisión: lo que la IA propuso o señaló y nadie ha decidido todavía. */
export function listarPendientes(db: Base): ElementoPendiente[] {
	return db
		.prepare(
			`SELECT p.id, p.tipo, p.video_id AS videoId, v.titulo, p.fragmento_id AS fragmentoId,
				f.inicio_ms AS inicioMs, f.texto, p.categoria, p.contenido
			 FROM pendientes p
			 JOIN videos v ON v.id = p.video_id
			 LEFT JOIN fragmentos f ON f.id = p.fragmento_id
			 WHERE p.estado = 'pendiente'
			 ORDER BY v.creado_en, p.tipo, f.inicio_ms`
		)
		.all() as ElementoPendiente[];
}

/**
 * Registra la decisión humana y su efecto: un fragmento aprobado se publica y uno oculto sale de
 * la transcripción pública, de la búsqueda y del agente. Queda constancia de quién y cuándo.
 */
export function decidir(db: Base, id: number, decision: Decision, quien: string): boolean {
	const elemento = db
		.prepare(`SELECT tipo, fragmento_id FROM pendientes WHERE id = ? AND estado = 'pendiente'`)
		.get(id) as { tipo: string; fragmento_id: number | null } | undefined;
	if (!elemento) return false;
	db.transaction(() => {
		db.prepare(
			`UPDATE pendientes SET estado = ?, decidido_por = ?, decidido_en = datetime('now') WHERE id = ?`
		).run(decision, quien, id);
		if (elemento.tipo === 'fragmento_sensible' && elemento.fragmento_id !== null) {
			db.prepare(`UPDATE fragmentos SET visibilidad = ? WHERE id = ?`).run(
				decision === 'aprobado' ? 'visible' : 'oculto',
				elemento.fragmento_id
			);
			olvidarRespuestas(db);
		}
	})();
	return true;
}
