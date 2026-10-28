import type { Base } from './base';
import type { RegistroGasto, UsoMedido } from '../meta/cliente';

/** Guarda en la base cada uso de la API que informa el cliente de Meta. */
export function registroGastoSqlite(db: Base): RegistroGasto {
	const insertar = db.prepare(
		`INSERT INTO gasto (modelo, operacion, tokens_entrada, tokens_cache, tokens_salida,
			segundos_audio, costo_usd)
		 VALUES (@modelo, @operacion, @tokensEntrada, @tokensCache, @tokensSalida,
			@segundosAudio, @costoUsd)`
	);
	return {
		registrar(uso: UsoMedido) {
			insertar.run(uso);
		}
	};
}

/** Gasto acumulado desde la medianoche UTC del día indicado (por defecto, hoy). */
export function gastoDelDia(db: Base, dia = new Date()): number {
	const desde = dia.toISOString().slice(0, 10);
	const fila = db
		.prepare(`SELECT COALESCE(SUM(costo_usd), 0) AS total FROM gasto WHERE momento >= ?`)
		.get(desde) as { total: number };
	return fila.total;
}
