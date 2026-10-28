import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as ReadableStreamWeb } from 'node:stream/web';
import { ADMIN_TOKEN } from '$app/env/private';
import { exigirAdmin } from '#lib/server/acceso.js';
import { ARCHIVO_ORIGINAL, registrarVideo } from '#lib/server/ingesta/pipeline.js';
import { MedioInvalido, probar } from '#lib/server/medios/ffmpeg.js';
import { obtenerServicios } from '#lib/server/servicios.js';
import type { RequestHandler } from './$types';

/**
 * Sube un video. El archivo va como cuerpo crudo (no multipart) para escribirlo en disco por
 * partes, sin cargarlo entero en memoria. El título va en `?titulo=`.
 */
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	exigirAdmin(request, ADMIN_TOKEN, cookies);
	const titulo = url.searchParams.get('titulo')?.trim() ?? '';
	if (!titulo || titulo.length > 200) error(400, 'Falta el título (máx. 200 caracteres)');
	if (!request.body) error(400, 'Falta el archivo de video');

	const { db, rutas, carpetaMedios, encolarProcesamiento } = obtenerServicios();
	const id = randomUUID();
	const carpeta = join(carpetaMedios, id);
	const original = join(carpeta, ARCHIVO_ORIGINAL);
	await mkdir(carpeta, { recursive: true });

	try {
		await pipeline(
			Readable.fromWeb(request.body as ReadableStreamWeb<Uint8Array>),
			createWriteStream(original)
		);
		const info = await probar(rutas, original);
		const faltan = [!info.video && 'video', !info.audio && 'audio'].filter(Boolean);
		if (faltan.length)
			throw new MedioInvalido(`El archivo no tiene pista de ${faltan.join(' ni de ')}`);
	} catch (causa) {
		await rm(carpeta, { recursive: true, force: true });
		if (causa instanceof MedioInvalido) error(400, causa.message);
		throw causa;
	}

	registrarVideo(db, id, titulo);
	encolarProcesamiento(id);
	return json({ id, estado: 'procesando' }, { status: 202 });
};
