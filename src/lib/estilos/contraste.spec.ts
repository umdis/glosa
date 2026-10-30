import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Mide el contraste de los tokens de color de `base.css` en los dos temas (WCAG 2.2):
 * texto ≥ 4,5:1 y bordes de control ≥ 3:1. Lee el CSS de verdad, así que un cambio de color
 * que rompa el contraste falla aquí antes de llegar a la pantalla.
 */
const css = readFileSync(new URL('./base.css', import.meta.url), 'utf8');

function tokens(bloque: string): Record<string, string> {
	const salida: Record<string, string> = {};
	for (const [, nombre, valor] of bloque.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
		salida[nombre] = valor.toLowerCase();
	}
	return salida;
}

const claro = tokens(
	css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'))
);
const oscuro = {
	...claro,
	...tokens(css.slice(css.indexOf('@media (prefers-color-scheme: dark)')))
};

function luminancia(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
	const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
	return (l1 + 0.05) / (l2 + 0.05);
}

const superficies = ['fondo', 'papel', 'papel-alto'];
/** Texto sobre cada superficie, y la letra de los botones principales (fondo sobre tinta). */
const texto: Array<[string, string]> = [
	...['tinta', 'suave', 'rubrica'].flatMap((t) => superficies.map((s): [string, string] => [t, s])),
	['fondo', 'tinta'],
	// La lámina de tinta: su texto, su carmín y el botón de vitela con letra de lámina.
	['lamina-tinta', 'lamina'],
	['lamina-suave', 'lamina'],
	['lamina-rubrica', 'lamina']
];
/** Bordes de campos, del interruptor y el foco, sobre cada superficie. */
const control: Array<[string, string]> = [
	...['suave', 'tinta'].flatMap((t) => superficies.map((s): [string, string] => [t, s])),
	['lamina-suave', 'lamina'],
	['lamina-tinta', 'lamina']
];

describe.each([
	['claro', claro],
	['oscuro', oscuro]
])('contraste del tema %s', (_tema, t) => {
	it.each(texto)('texto %s sobre %s ≥ 4,5:1', (frente, fondo) => {
		expect(t[frente], `falta --${frente}`).toBeDefined();
		expect(contraste(t[frente], t[fondo])).toBeGreaterThanOrEqual(4.5);
	});

	it.each(control)('borde %s sobre %s ≥ 3:1', (frente, fondo) => {
		expect(contraste(t[frente], t[fondo])).toBeGreaterThanOrEqual(3);
	});
});
