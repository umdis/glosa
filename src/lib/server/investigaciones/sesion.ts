import type { Cookies } from '@sveltejs/kit';

/**
 * Las investigaciones que este navegador puede editar (design.md D1). Una sola cookie httpOnly
 * con pares «id.secreto»: así el secreto no queda en la URL que se comparte ni al alcance de los
 * scripts de la página, y «Add to investigation» puede listar las propias desde cualquier pantalla.
 */

export const COOKIE_CUADERNOS = 'glosa_cuadernos';
/** Cuántas recuerda un navegador; las más antiguas se olvidan (siguen editables con su enlace). */
export const MAXIMO_RECORDADAS = 20;

const PAR = /^([a-z2-9]{10})\.([A-Za-z0-9_-]{43})$/;

type CookiesLectura = Pick<Cookies, 'get'>;

function leer(cookies: CookiesLectura): Array<[string, string]> {
	const valor = cookies.get(COOKIE_CUADERNOS) ?? '';
	return valor
		.split('|')
		.map((par) => PAR.exec(par))
		.filter((m): m is RegExpExecArray => m !== null)
		.map((m) => [m[1], m[2]] as [string, string]);
}

function escribir(cookies: Pick<Cookies, 'set'>, pares: Array<[string, string]>): void {
	cookies.set(COOKIE_CUADERNOS, pares.map(([id, s]) => `${id}.${s}`).join('|'), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});
}

/** Ids de las investigaciones recordadas, de la más reciente a la más antigua. */
export function propias(cookies: CookiesLectura): string[] {
	return leer(cookies).map(([id]) => id);
}

export function secretoDe(cookies: CookiesLectura, id: string): string | undefined {
	return leer(cookies).find(([i]) => i === id)?.[1];
}

/** Recuerda (o pone primera) una investigación con su secreto. */
export function recordar(cookies: Pick<Cookies, 'get' | 'set'>, id: string, secreto: string): void {
	if (!PAR.test(`${id}.${secreto}`)) return;
	const resto = leer(cookies).filter(([i]) => i !== id);
	escribir(cookies, [[id, secreto] as [string, string], ...resto].slice(0, MAXIMO_RECORDADAS));
}

export function olvidar(cookies: Pick<Cookies, 'get' | 'set'>, id: string): void {
	escribir(
		cookies,
		leer(cookies).filter(([i]) => i !== id)
	);
}
