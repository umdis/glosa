import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';

/**
 * Sirve un archivo de medios con soporte de rangos (`Range`), que el navegador necesita para
 * saltar a un minuto sin descargar el archivo entero. Lo usan el video y los clips.
 */
export async function servirConRangos(
	ruta: string,
	request: Request,
	cabecerasExtra: Record<string, string>
): Promise<Response> {
	const { size } = await stat(ruta).catch(() => error(404, 'Not available'));
	const cabeceras = { 'Accept-Ranges': 'bytes', ...cabecerasExtra };
	const rango = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (!rango) {
		return new Response(Readable.toWeb(createReadStream(ruta)) as ReadableStream, {
			headers: { ...cabeceras, 'Content-Length': String(size) }
		});
	}

	let inicio = rango[1] ? Number(rango[1]) : size - Number(rango[2]);
	let fin = rango[1] && rango[2] ? Number(rango[2]) : size - 1;
	inicio = Math.max(0, inicio);
	fin = Math.min(fin, size - 1);
	if (inicio > fin || Number.isNaN(inicio)) {
		return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
	}
	return new Response(
		Readable.toWeb(createReadStream(ruta, { start: inicio, end: fin })) as ReadableStream,
		{
			status: 206,
			headers: {
				...cabeceras,
				'Content-Range': `bytes ${inicio}-${fin}/${size}`,
				'Content-Length': String(fin - inicio + 1)
			}
		}
	);
}
