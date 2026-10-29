import {
	Document,
	ExternalHyperlink,
	HeadingLevel,
	Packer,
	Paragraph,
	TextRun,
	type ParagraphChild
} from 'docx';
import { folio } from '../../formato';
import type { Bloque, Investigacion } from './datos';

/**
 * Exportación de una investigación (spec investigaciones: «Publicar y exportar»). En todos los
 * formatos cada cita lleva la frase, el video, el minuto y el enlace a ese momento. Las citas
 * retiradas no salen.
 */

export function enlaceMomento(
	origen: string,
	videoId: string,
	inicioMs: number,
	fragmentoId: number
) {
	return `${origen}/videos/${videoId}?t=${Math.floor(inicioMs / 1000)}#f-${fragmentoId}`;
}

const PIE = 'Every quote was checked against the video transcript with Glosa.';

export function aMarkdown(investigacion: Investigacion, bloques: Bloque[], origen: string): string {
	const partes = [`# ${investigacion.titulo}`, ''];
	for (const b of bloques) {
		if (b.tipo === 'cita') {
			if (!b.cita) continue;
			const url = enlaceMomento(origen, b.cita.videoId, b.cita.inicioMs, b.cita.fragmentoId);
			partes.push(
				`> «${b.cita.frase}»`,
				`> — [${b.cita.titulo}, ${folio(b.cita.inicioMs)}](${url})`,
				''
			);
		} else if (b.tipo === 'titulo') {
			partes.push(`## ${b.texto}`, '');
		} else if (b.tipo === 'nota') {
			partes.push(...b.texto.split('\n').map((l) => `_${l || ' '}_`), '');
		} else {
			partes.push(b.texto, '');
		}
	}
	partes.push(`_${PIE}_`, '');
	return partes.join('\n');
}

function parrafosDe(texto: string, opciones: { italics?: boolean } = {}): Paragraph[] {
	return texto.split(/\n{2,}/).map(
		(p) =>
			new Paragraph({
				children: [new TextRun({ text: p.replace(/\n/g, ' '), ...opciones })],
				spacing: { after: 160 }
			})
	);
}

export async function aWord(
	investigacion: Investigacion,
	bloques: Bloque[],
	origen: string
): Promise<Buffer> {
	const cuerpo: Paragraph[] = [
		new Paragraph({ text: investigacion.titulo, heading: HeadingLevel.TITLE })
	];
	for (const b of bloques) {
		if (b.tipo === 'cita') {
			if (!b.cita) continue;
			const url = enlaceMomento(origen, b.cita.videoId, b.cita.inicioMs, b.cita.fragmentoId);
			const fuente: ParagraphChild[] = [
				new TextRun({ text: '— ' }),
				new ExternalHyperlink({
					link: url,
					children: [
						new TextRun({ text: `${b.cita.titulo}, ${folio(b.cita.inicioMs)}`, style: 'Hyperlink' })
					]
				})
			];
			cuerpo.push(
				new Paragraph({
					children: [new TextRun({ text: `«${b.cita.frase}»`, italics: true })],
					indent: { left: 567 },
					spacing: { after: 60 }
				}),
				new Paragraph({ children: fuente, indent: { left: 567 }, spacing: { after: 200 } })
			);
		} else if (b.tipo === 'titulo') {
			cuerpo.push(new Paragraph({ text: b.texto, heading: HeadingLevel.HEADING_1 }));
		} else {
			cuerpo.push(...parrafosDe(b.texto, { italics: b.tipo === 'nota' }));
		}
	}
	cuerpo.push(new Paragraph({ children: [new TextRun({ text: PIE, italics: true, size: 18 })] }));
	const documento = new Document({
		title: investigacion.titulo,
		creator: 'Glosa',
		styles: { default: { document: { run: { font: 'Georgia', size: 24 } } } },
		sections: [{ children: cuerpo }]
	});
	return Packer.toBuffer(documento);
}

/** Nombre de archivo seguro a partir del título. */
export function nombreArchivo(titulo: string, extension: string): string {
	const base =
		titulo
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			.replace(/[^\p{L}\p{N}]+/gu, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 60) || 'investigation';
	return `${base}.${extension}`;
}
