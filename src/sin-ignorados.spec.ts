import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Ningún archivo del código puede quedar fuera de git. Dos veces una regla pensada para medios de
 * prueba (`media/`, `*.mp4`) se tragó una ruta de SvelteKit (`videos/[id]/media`,
 * `c/[fragmento]/clip.mp4`): en local funcionaba y en producción daba 404.
 */
describe('código versionado', () => {
	it('no hay archivos ignorados dentro de src/ ni de fuentes/', () => {
		let ignorados: string;
		try {
			ignorados = execFileSync(
				'git',
				['ls-files', '--others', '--ignored', '--exclude-standard', '--', 'src', 'fuentes'],
				{ encoding: 'utf8' }
			);
		} catch {
			// Fuera de un repositorio git (p. ej. dentro de la imagen) no hay nada que comprobar.
			return;
		}
		expect(ignorados.split('\n').filter(Boolean)).toEqual([]);
	});
});
