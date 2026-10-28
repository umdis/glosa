import { defineEnvVars } from '@sveltejs/kit/env';
import { carpetaDatos, mostrarFotogramas, opcional, topeGastoDiario } from './lib/server/config';

/** Variables de entorno del servidor (`$app/env/private`). Ninguna llega al navegador. */
export const variables = defineEnvVars({
	DATA_DIR: {
		schema: carpetaDatos,
		description: 'Carpeta del volumen con la base de datos y los medios.'
	},
	MODEL_API_KEY: {
		schema: opcional,
		description: 'Clave de la Meta Model API. Solo en el servidor.'
	},
	ADMIN_TOKEN: {
		schema: opcional,
		description: 'Clave de administrador para subir, revisar y borrar contenido.'
	},
	FFMPEG_PATH: {
		schema: (valor) => valor || 'ffmpeg',
		description: 'Ruta de ffmpeg (por defecto, el del PATH).'
	},
	FFPROBE_PATH: {
		schema: (valor) => valor || 'ffprobe',
		description: 'Ruta de ffprobe (por defecto, el del PATH).'
	},
	DAILY_SPEND_CAP_USD: {
		schema: topeGastoDiario,
		description: 'Tope de gasto diario de la demo, en dólares (5 por defecto).'
	},
	SHOW_FRAMES: {
		schema: mostrarFotogramas,
		description: 'Muestra fotogramas del video (activo por defecto; «false» los apaga).'
	}
});
