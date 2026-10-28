import { folio } from './formato';

/**
 * Estudio citado (spec estudio-citado): borrador en Markdown a partir de una respuesta del agente.
 * Solo entran las afirmaciones respaldadas y sus citas verificadas; nada sin respaldo.
 * No llama a la IA: se compone con lo que ya se verificó.
 */

interface CitaParaEstudio {
	estado: string;
	frase: string;
	videoId?: string;
	titulo?: string;
	inicioMs?: number;
	fragmentoId: number;
}

interface RespuestaParaEstudio {
	pregunta: string;
	afirmaciones: Array<{ texto: string; respaldo: string; citas: CitaParaEstudio[] }>;
}

export function borradorEstudio(respuesta: RespuestaParaEstudio, origen: string): string {
	const partes = [`# ${respuesta.pregunta}`, ''];
	for (const afirmacion of respuesta.afirmaciones) {
		if (afirmacion.respaldo !== 'respaldada') continue;
		partes.push(afirmacion.texto, '');
		for (const cita of afirmacion.citas) {
			if (cita.estado !== 'verificada' || cita.videoId === undefined || cita.inicioMs === undefined)
				continue;
			const url = `${origen}/videos/${cita.videoId}?t=${Math.floor(cita.inicioMs / 1000)}#f-${cita.fragmentoId}`;
			partes.push(`> «${cita.frase}»`, `> — [${cita.titulo}, ${folio(cita.inicioMs)}](${url})`, '');
		}
	}
	partes.push('_Every quote was checked against the video transcript with Glosa._', '');
	return partes.join('\n');
}

const escapar = (texto: string) =>
	texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Enlaces [texto](url) solo si la url es http(s): nada de javascript: ni similares. */
function enLinea(texto: string): string {
	return escapar(texto)
		.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
		.replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1<em>$2</em>');
}

/**
 * Convierte el subconjunto de Markdown del estudio (títulos, párrafos, citas en bloque, enlaces,
 * cursiva) en HTML para imprimir. Todo el texto se escapa antes: lo que escriba la persona no
 * puede inyectar HTML.
 */
export function markdownImprimible(markdown: string): string {
	const bloques = markdown.replace(/\r\n/g, '\n').split(/\n{2,}/);
	return bloques
		.map((bloque) => bloque.trim())
		.filter(Boolean)
		.map((bloque) => {
			const titulo = /^(#{1,3})\s+(.*)$/.exec(bloque);
			if (titulo && !bloque.includes('\n')) {
				const nivel = titulo[1].length;
				return `<h${nivel}>${enLinea(titulo[2])}</h${nivel}>`;
			}
			const lineas = bloque.split('\n');
			if (lineas.every((l) => l.startsWith('>'))) {
				const dentro = lineas.map((l) => enLinea(l.replace(/^>\s?/, ''))).join('<br>');
				return `<blockquote>${dentro}</blockquote>`;
			}
			return `<p>${lineas.map(enLinea).join('<br>')}</p>`;
		})
		.join('\n');
}
