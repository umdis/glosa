/**
 * Enlaces de YouTube (spec origen-youtube; design.md D13). Solo se valida y se enlaza: Glosa nunca
 * descarga nada de YouTube. Compartido entre servidor y navegador (no usa nada del servidor).
 */

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * El enlace canónico (`https://www.youtube.com/watch?v=<id>`) de un enlace de YouTube, o `null`
 * si no lo es. Se valida antes de cualquier petición: host exacto, https/http y un id de 11.
 */
export function enlaceYoutube(entrada: string): string | null {
	let url: URL;
	try {
		url = new URL(entrada.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	if (!HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port)
		return null;
	const id =
		url.hostname.toLowerCase() === 'youtu.be'
			? url.pathname.slice(1)
			: url.pathname === '/watch'
				? url.searchParams.get('v')
				: (/^\/(live|shorts|embed)\/([^/]+)\/?$/.exec(url.pathname)?.[2] ?? null);
	return id && ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** El mismo video de YouTube en un segundo dado. */
export function youtubeEnMinuto(canonico: string, segundos: number): string {
	return `${canonico}&t=${Math.max(0, Math.floor(segundos))}s`;
}
