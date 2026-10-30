import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import qrcode from 'qrcode-generator';
import { rutaEnFiltro, existe } from '../clips/generar';
import { textoAss } from '../clips/subtitulos';
import { MODELO_RAZONAMIENTO, type ClienteMeta } from '../meta/cliente';

const ejecutar = promisify(execFile);

/**
 * Láminas (spec laminas-ilustradas; design.md D8 de glosa-competitiva). Una imagen 4:5 para
 * compartir una cita verificada: arriba la ilustración de Muse Image (sin personas, sin rostros,
 * sin texto), abajo la frase, su fuente y un QR al minuto exacto en Glosa. Se compone en un paso
 * de ffmpeg con subtítulos ASS y la fuente de la casa, como los clips: sin binarios nativos nuevos.
 */

export const ANCHO = 1080;
export const ALTO = 1350;
const ALTO_ILUSTRACION = 760;
const LADO_QR = 210;
const MARGEN = 64;

/** La clave de caché de una lámina: el fragmento y la frase exacta. */
export function claveLamina(fragmentoId: number, frase: string): string {
	return `${fragmentoId}-${createHash('sha256').update(frase).digest('hex').slice(0, 16)}`;
}

/**
 * El prompt de la ilustración sale del tema, nunca de la frase ni de nombres: Muse Image no recibe
 * nada que identifique a nadie, y se le pide expresamente que no dibuje personas ni texto.
 */
export function promptIlustracion(tema: string): string {
	const limpio = tema
		.replace(/[^\p{L}\p{N} ,'-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 80);
	return (
		`Abstract editorial illustration about ${limpio || 'faith and everyday life'}. ` +
		'Ink and watercolor on aged vellum, iron-gall ink lines with muted earth tones, like a ' +
		'manuscript marginal drawing. No people, no faces, no hands, no text, no letters, no symbols of any brand.'
	);
}

/**
 * El QR como imagen PGM (P5) en blanco y negro: ffmpeg la lee sin librerías de imagen. Se dibuja
 * ya a su tamaño final, con módulos de un número entero de píxeles: reescalarlo los deformaría.
 */
export function qrPgm(url: string, ladoMaximo = LADO_QR, margenModulos = 2): Uint8Array {
	const qr = qrcode(0, 'M');
	qr.addData(url);
	qr.make();
	const n = qr.getModuleCount();
	const modulo = Math.max(2, Math.floor(ladoMaximo / (n + 2 * margenModulos)));
	const lado = (n + 2 * margenModulos) * modulo;
	const cabecera = new TextEncoder().encode(`P5\n${lado} ${lado}\n255\n`);
	const pixeles = new Uint8Array(lado * lado).fill(255);
	for (let fila = 0; fila < n; fila++) {
		for (let col = 0; col < n; col++) {
			if (!qr.isDark(fila, col)) continue;
			for (let y = 0; y < modulo; y++) {
				const inicio =
					((fila + margenModulos) * modulo + y) * lado + (col + margenModulos) * modulo;
				pixeles.fill(0, inicio, inicio + modulo);
			}
		}
	}
	const salida = new Uint8Array(cabecera.length + pixeles.length);
	salida.set(cabecera);
	salida.set(pixeles, cabecera.length);
	return salida;
}

/** El texto de la lámina en ASS: la frase en cursiva, su fuente en carmín y el pie con las menciones. */
export function subtitulosLamina(datos: { frase: string; fuente: string; pie: string }): string {
	const frase = textoAss(datos.frase);
	// Las frases largas bajan de cuerpo para que quepan sobre la vitela sin tocar el QR.
	const cuerpo = frase.length > 170 ? 40 : frase.length > 110 ? 46 : frase.length > 60 ? 56 : 72;
	const derecha = MARGEN + LADO_QR + 32;
	return `[Script Info]
ScriptType: v4.00+
PlayResX: ${ANCHO}
PlayResY: ${ALTO}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Frase,Alegreya Sans,${cuerpo},&H00332520,&H00332520,&H00000000,&H00000000,0,-1,0,0,100,100,0,0,1,0,0,7,${MARGEN},${MARGEN},${ALTO_ILUSTRACION + 48},1
Style: Fuente,Alegreya Sans,34,&H002A12A3,&H002A12A3,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,1,${MARGEN},${derecha},${MARGEN + 52},1
Style: Pie,Alegreya Sans,26,&H00625149,&H00625149,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,1,${MARGEN},${derecha},${MARGEN},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:10.00,Frase,,0,0,0,,«${frase}»
Dialogue: 0,0:00:00.00,0:00:10.00,Fuente,,0,0,0,,${textoAss(datos.fuente)}
Dialogue: 0,0:00:00.00,0:00:10.00,Pie,,0,0,0,,${textoAss(datos.pie)}
`;
}

/** ffmpeg: vitela de fondo, ilustración recortada arriba, QR abajo a la derecha y el texto encima. */
export function argumentosLamina(rutas: {
	ilustracion: string;
	qr: string;
	subtitulos: string;
	fuentes: string;
	salida: string;
}): string[] {
	const ass = `ass=${rutaEnFiltro(rutas.subtitulos)}:fontsdir=${rutaEnFiltro(rutas.fuentes)}`;
	return [
		'-v',
		'error',
		'-y',
		'-i',
		rutas.ilustracion,
		'-i',
		rutas.qr,
		'-f',
		'lavfi',
		'-i',
		`color=c=0xeceee8:s=${ANCHO}x${ALTO}`,
		'-filter_complex',
		`[0:v]scale=${ANCHO}:${ALTO_ILUSTRACION}:force_original_aspect_ratio=increase,crop=${ANCHO}:${ALTO_ILUSTRACION}[il];` +
			// El QR entra a su tamaño: sin reescalar, cada módulo sigue siendo un cuadrado exacto.
			`[2:v][il]overlay=0:0[a];[a][1:v]overlay=W-w-${MARGEN}:H-h-${MARGEN},${ass},format=rgb24[v]`,
		'-map',
		'[v]',
		'-frames:v',
		'1',
		rutas.salida
	];
}

export interface PedidoLamina {
	clave: string;
	frase: string;
	/** «Título del video, ¶ m:ss». */
	fuente: string;
	/** Dirección absoluta del minuto en Glosa, para el QR. */
	enlace: string;
}

export interface DependenciasLamina {
	meta: Pick<ClienteMeta, 'chat' | 'generarImagen'>;
	ffmpeg: string;
	carpeta: string;
	fuentes: string;
}

/** Dónde queda la lámina ya hecha. */
export const rutaLamina = (carpeta: string, clave: string) => join(carpeta, `${clave}.png`);

/**
 * El tema de la frase, en pocas palabras y sin nombres, para el prompt de la ilustración. Si Muse
 * Spark no responde, se usa un tema genérico: la lámina sale igual.
 */
async function temaDe(meta: Pick<ClienteMeta, 'chat'>, frase: string): Promise<string> {
	try {
		const r = await meta.chat(
			{
				model: MODELO_RAZONAMIENTO,
				messages: [
					{
						role: 'system',
						content:
							'Name the abstract theme of this sermon quote in 3 to 6 English words, for an illustrator. No names of people or places, no quotes. Reply with the words only.'
					},
					{ role: 'user', content: frase }
				]
			},
			'tema_lamina'
		);
		return String(r.choices[0]?.message.content ?? '').split('\n')[0];
	} catch {
		return '';
	}
}

/** Genera la lámina si no existe y devuelve su ruta. Nunca deja un archivo a medio escribir. */
export async function generarLamina(
	deps: DependenciasLamina,
	pedido: PedidoLamina
): Promise<string> {
	const destino = rutaLamina(deps.carpeta, pedido.clave);
	if (await existe(destino)) return destino;
	await mkdir(deps.carpeta, { recursive: true });
	const trabajo = join(deps.carpeta, `.${pedido.clave}-${process.pid}-${Date.now()}`);
	await mkdir(trabajo, { recursive: true });
	try {
		const ilustracion = await deps.meta.generarImagen(
			promptIlustracion(await temaDe(deps.meta, pedido.frase))
		);
		const rutas = {
			ilustracion: join(trabajo, 'ilustracion.png'),
			qr: join(trabajo, 'qr.pgm'),
			subtitulos: join(trabajo, 'lamina.ass'),
			fuentes: deps.fuentes,
			salida: join(trabajo, 'lamina.png')
		};
		await writeFile(rutas.ilustracion, ilustracion);
		await writeFile(rutas.qr, qrPgm(pedido.enlace));
		await writeFile(
			rutas.subtitulos,
			subtitulosLamina({
				frase: pedido.frase,
				fuente: pedido.fuente,
				pie: 'Verified quote, scan to hear it.  Illustration: Muse Image.  glosa.umdis.site'
			})
		);
		await ejecutar(deps.ffmpeg, argumentosLamina(rutas), { timeout: 60_000 });
		await rename(rutas.salida, destino);
		return destino;
	} finally {
		await rm(trabajo, { recursive: true, force: true });
	}
}
