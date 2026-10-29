import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { Bloque, Investigacion } from './datos';
import { aMarkdown, aWord, nombreArchivo } from './exportar';

const investigacion: Investigacion = {
	id: 'abcdefghjk',
	titulo: 'Familia y perdón',
	publicada: false,
	retirada: false,
	actualizadaEn: ''
};

const bloques: Bloque[] = [
	{ id: 1, orden: 1, tipo: 'titulo', texto: 'Introducción', origenIa: false },
	{ id: 2, orden: 2, tipo: 'texto', texto: 'El perdón se aprende en casa.', origenIa: true },
	{
		id: 3,
		orden: 3,
		tipo: 'cita',
		origenIa: false,
		cita: {
			frase: 'El perdón empieza en la casa',
			fragmentoId: 42,
			videoId: 'v1',
			titulo: 'Familia',
			inicioMs: 754_000
		}
	},
	{ id: 4, orden: 4, tipo: 'cita', origenIa: false, cita: null },
	{ id: 5, orden: 5, tipo: 'nota', texto: 'Preguntar al grupo', origenIa: false }
];

describe('exportar', () => {
	it('Markdown con títulos, citas enlazadas al minuto y sin citas retiradas', () => {
		const md = aMarkdown(investigacion, bloques, 'https://glosa.umdis.site');
		expect(md).toContain('# Familia y perdón');
		expect(md).toContain('## Introducción');
		expect(md).toContain('> «El perdón empieza en la casa»');
		expect(md).toContain('> — [Familia, 12:34](https://glosa.umdis.site/videos/v1?t=754#f-42)');
		expect(md).toContain('_Preguntar al grupo_');
		expect(md.match(/^> «/gm)).toHaveLength(1);
	});

	it('Word es un .docx válido con el hipervínculo al minuto', async () => {
		const buffer = await aWord(investigacion, bloques, 'https://glosa.umdis.site');
		// fflate es la dependencia de compresión de docx; se usa aquí solo para abrir el archivo.
		const archivos = unzipSync(new Uint8Array(buffer));
		const texto = (ruta: string) => strFromU8(archivos[ruta]);
		// docx separa el «#f-42» del destino; el minuto viaja en ?t=, que es lo que posiciona el video.
		expect(texto('word/_rels/document.xml.rels')).toContain(
			'Target="https://glosa.umdis.site/videos/v1?t=754'
		);
		const documento = texto('word/document.xml');
		expect(documento).toContain('«El perdón empieza en la casa»');
		expect(documento).toContain('Familia, 12:34');
		expect(documento).toContain('Introducción');
	});

	it('nombre de archivo sin tildes ni símbolos', () => {
		expect(nombreArchivo('Familia y perdón: ¿qué dice?', 'docx')).toBe(
			'Familia-y-perdon-que-dice.docx'
		);
		expect(nombreArchivo('¿?', 'md')).toBe('investigation.md');
	});
});
