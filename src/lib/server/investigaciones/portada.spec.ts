import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import { pedidoPortada } from './portada';

describe('pedidoPortada', () => {
	it('título, cuenta de citas vigentes, QR a la lectura y clave que cambia con el título', () => {
		const db = abrirBase(':memory:');
		db.prepare(
			`INSERT INTO investigaciones (id, titulo, secreto_hash) VALUES ('abcdefghjk', 'Criar', 'x')`
		).run();
		db.prepare(
			`INSERT INTO bloques (investigacion_id, orden, tipo, texto, fragmento_id)
			 VALUES ('abcdefghjk', 1, 'texto', 'intro', NULL), ('abcdefghjk', 2, 'cita', 'retirada', NULL)`
		).run();
		const p = pedidoPortada(db, { id: 'abcdefghjk', titulo: 'Criar' }, 'https://glosa.umdis.site');
		expect(p.frase).toBe('Criar');
		expect(p.fuente).toBe('0 verified quotes from video');
		expect(p.enlace).toBe('https://glosa.umdis.site/investigations/abcdefghjk');
		expect(p.clave).toMatch(/^portada-abcdefghjk-[0-9a-f]{16}$/);
		expect(p.pie).toContain('scan to read it');
		expect(p.cita).toBe(false);
		const otro = pedidoPortada(db, { id: 'abcdefghjk', titulo: 'Criar hijos' }, 'https://x');
		expect(otro.clave).not.toBe(p.clave);
	});
});
