import { ejecutarHerramienta } from '../agente/herramientas';
import type { Base } from '../db/base';

/** ¿Puede el agente encontrar esta palabra con su herramienta de búsqueda? (solo para pruebas) */
export function agenteHerramientasVisibles(db: Base, consulta: string): boolean {
	const salida = JSON.parse(ejecutarHerramienta(db, 'buscar', { consulta }, new Map()));
	return Array.isArray(salida) && salida.length > 0;
}
