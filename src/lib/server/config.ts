/**
 * Validación de la configuración del servidor. Las variables se declaran en `src/env.ts`
 * (SvelteKit las expone en `$app/env/private`); aquí solo vive la lógica, sin dependencias
 * de SvelteKit, para poder probarla. Los secretos solo viven en variables de entorno.
 */
export interface Config {
	/** Carpeta del volumen: base de datos y medios. */
	dataDir: string;
	/** Clave de la Meta Model API. Puede faltar en desarrollo; el cliente falla al usarla. */
	modelApiKey: string | undefined;
	/** Clave de administrador para subir, revisar y borrar. */
	adminToken: string | undefined;
	/** Tope de gasto diario de la demo, en dólares. */
	topeGastoDiarioUsd: number;
}

type Fuente = Record<string, string | undefined>;

export function opcional(valor: string | undefined): string | undefined {
	return valor || undefined;
}

export function carpetaDatos(valor: string | undefined): string {
	return valor || './data';
}

export function topeGastoDiario(valor: string | undefined): number {
	const tope = Number(valor ?? '5');
	if (!Number.isFinite(tope) || tope < 0) {
		throw new Error('DAILY_SPEND_CAP_USD debe ser un número mayor o igual a 0');
	}
	return tope;
}

export function leerConfig(fuente: Fuente): Config {
	return {
		dataDir: carpetaDatos(fuente.DATA_DIR),
		modelApiKey: opcional(fuente.MODEL_API_KEY),
		adminToken: opcional(fuente.ADMIN_TOKEN),
		topeGastoDiarioUsd: topeGastoDiario(fuente.DAILY_SPEND_CAP_USD)
	};
}
