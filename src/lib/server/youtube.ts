import { enlaceYoutube } from '../youtube';

export interface DatosYoutube {
	url: string;
	titulo: string;
	canal: string;
	miniatura: string | null;
}

/**
 * Título, canal y miniatura por oEmbed (sin clave). El enlace se valida antes: si no es de
 * YouTube no se hace ninguna petición (spec origen-youtube).
 */
export async function consultarYoutube(
	entrada: string,
	pedir: typeof fetch = fetch
): Promise<{ ok: true; datos: DatosYoutube } | { ok: false; error: string }> {
	const url = enlaceYoutube(entrada);
	if (!url) {
		return { ok: false, error: 'That is not a YouTube link (youtube.com or youtu.be).' };
	}
	let respuesta: Response;
	try {
		respuesta = await pedir(
			`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
			{ signal: AbortSignal.timeout(10_000) }
		);
	} catch {
		return { ok: false, error: 'YouTube did not answer. Try again in a moment.' };
	}
	if (!respuesta.ok) {
		return {
			ok: false,
			error:
				respuesta.status === 401 || respuesta.status === 403
					? 'That video is private or cannot be embedded.'
					: 'YouTube does not know that video.'
		};
	}
	const datos = (await respuesta.json()) as {
		title?: unknown;
		author_name?: unknown;
		thumbnail_url?: unknown;
	};
	return {
		ok: true,
		datos: {
			url,
			titulo: typeof datos.title === 'string' ? datos.title.slice(0, 200) : '',
			canal: typeof datos.author_name === 'string' ? datos.author_name.slice(0, 120) : '',
			miniatura: typeof datos.thumbnail_url === 'string' ? datos.thumbnail_url : null
		}
	};
}
