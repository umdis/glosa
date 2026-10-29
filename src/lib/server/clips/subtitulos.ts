import type { VentanaClip } from './ventana';

/**
 * Subtítulos del clip en ASS (design.md D5): el título arriba, la transcripción debajo del video
 * en tarjetas de dos líneas y la dirección de Glosa abajo. Las tarjetas se reparten el tiempo de
 * cada fragmento según su longitud, porque la API solo da tiempos por fragmento.
 */

export const ANCHO = 1080;
export const ALTO = 1920;
/** El video escalado a 1080 de ancho mide ~607 px; se coloca un poco por encima del centro. */
export const ALTO_VIDEO = 608;
export const DESPLAZAMIENTO_VIDEO = -140;
const ARRIBA_VIDEO = (ALTO - ALTO_VIDEO) / 2 + DESPLAZAMIENTO_VIDEO;
const DEBAJO_VIDEO = ARRIBA_VIDEO + ALTO_VIDEO;

/** Caracteres por línea y líneas por tarjeta: legible en un teléfono. */
const CARACTERES_LINEA = 30;
const LINEAS_TARJETA = 2;

/** Quita lo que ASS interpreta como órdenes: llaves, barras invertidas y saltos. */
export function textoAss(texto: string): string {
	return texto
		.replace(/\\/g, '/')
		.replace(/\{/g, '(')
		.replace(/\}/g, ')')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Tiempo ASS: h:mm:ss.cc */
export function tiempoAss(ms: number): string {
	const cs = Math.max(0, Math.round(ms / 10));
	const h = Math.floor(cs / 360_000);
	const m = Math.floor((cs % 360_000) / 6000);
	const s = Math.floor((cs % 6000) / 100);
	const c = cs % 100;
	return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

/** Parte un texto en tarjetas de hasta dos líneas, cortando por palabras. */
export function tarjetas(texto: string): string[] {
	const palabras = textoAss(texto).split(' ').filter(Boolean);
	const lineas: string[] = [];
	let actual = '';
	for (const palabra of palabras) {
		if (actual && (actual + ' ' + palabra).length > CARACTERES_LINEA) {
			lineas.push(actual);
			actual = palabra;
		} else {
			actual = actual ? `${actual} ${palabra}` : palabra;
		}
	}
	if (actual) lineas.push(actual);
	const resultado: string[] = [];
	for (let i = 0; i < lineas.length; i += LINEAS_TARJETA) {
		resultado.push(lineas.slice(i, i + LINEAS_TARJETA).join('\\N'));
	}
	return resultado;
}

export function subtitulosClip(
	ventana: VentanaClip,
	datos: { titulo: string; pie: string }
): string {
	const duracion = ventana.finMs - ventana.inicioMs;
	const eventos: string[] = [
		`Dialogue: 0,${tiempoAss(0)},${tiempoAss(duracion)},Titulo,,0,0,0,,${textoAss(datos.titulo)}`,
		`Dialogue: 0,${tiempoAss(0)},${tiempoAss(duracion)},Pie,,0,0,0,,${textoAss(datos.pie)}`
	];
	for (const f of ventana.fragmentos) {
		const partes = tarjetas(f.texto);
		const total = partes.reduce((n, p) => n + p.length, 0) || 1;
		let desde = Math.max(0, f.inicioMs - ventana.inicioMs);
		const fin = Math.min(duracion, f.finMs - ventana.inicioMs);
		for (const parte of partes) {
			const hasta = Math.min(
				fin,
				desde + ((fin - (f.inicioMs - ventana.inicioMs)) * parte.length) / total
			);
			eventos.push(`Dialogue: 0,${tiempoAss(desde)},${tiempoAss(hasta)},Sub,,0,0,0,,${parte}`);
			desde = hasta;
		}
	}

	// Colores ASS: &HAABBGGRR. Blanco con contorno de tinta; el pie, más tenue. El título va en una
	// caja oscura (BorderStyle 3) porque encima del video el fondo difuminado puede ser claro.
	// WrapStyle 0 parte el título si es largo; los subtítulos ya llegan partidos con \N.
	return `[Script Info]
ScriptType: v4.00+
PlayResX: ${ANCHO}
PlayResY: ${ALTO}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Titulo,Alegreya Sans,58,&H00FFFFFF,&H00FFFFFF,&H40141414,&H40141414,-1,0,0,0,100,100,0,0,3,16,0,2,90,90,${ALTO - ARRIBA_VIDEO + 60},1
Style: Sub,Alegreya Sans,68,&H00FFFFFF,&H00FFFFFF,&H00151515,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,8,70,70,${DEBAJO_VIDEO + 70},1
Style: Pie,Alegreya Sans,40,&H00E6E6E6,&H00E6E6E6,&H00202020,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,80,80,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${eventos.join('\n')}
`;
}
