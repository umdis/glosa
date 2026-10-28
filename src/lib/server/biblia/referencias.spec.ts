import { describe, expect, it } from 'vitest';
import { CANON } from './canon';
import {
	detectarDichas,
	detectarEscritas,
	formatoReferencia,
	leerNumero,
	validar
} from './referencias';

const frag = (id: number, segundos: number, texto: string) => ({
	id,
	inicioMs: segundos * 1000,
	texto
});
const formatos = (refs: Parameters<typeof formatoReferencia>[0][]) => refs.map(formatoReferencia);

describe('canon', () => {
	it('tiene 66 libros y 1.189 capítulos', () => {
		expect(CANON).toHaveLength(66);
		expect(CANON.reduce((s, l) => s + l.versiculos.length, 0)).toBe(1189);
	});
});

describe('validar', () => {
	it('descarta lo que no puede existir', () => {
		const r = (
			libro: string,
			capitulo: number,
			vi: number | null = null,
			vf: number | null = null
		) => validar({ libro, capitulo, versiculoInicio: vi, versiculoFin: vf });
		expect(r('Santiago', 1, 2)).not.toBeNull();
		expect(r('Santiago', 9, 4)).toBeNull(); // Santiago tiene 5 capítulos
		expect(r('Salmos', 119, 176)).not.toBeNull();
		expect(r('Salmos', 119, 177)).toBeNull();
		expect(r('Deuteronomio', 6, 9, 6)).toBeNull(); // rango al revés
		expect(r('3 Juan', 1, 15)).not.toBeNull(); // versificación Reina-Valera
		expect(r('Hechos de Pablo', 1)).toBeNull();
	});
});

describe('leerNumero', () => {
	it('lee cifras y números en palabras hasta 199', () => {
		const leer = (texto: string) => leerNumero(texto.split(' '), 0)?.valor ?? null;
		expect(leer('uno')).toBe(1);
		expect(leer('dieciséis'.normalize('NFD').replace(/\p{Mn}/gu, ''))).toBe(16);
		expect(leer('veintiocho')).toBe(28);
		expect(leer('treinta y cinco')).toBe(35);
		expect(leer('ciento diecinueve')).toBe(119);
		expect(leer('cien')).toBe(100);
		expect(leer('23')).toBe(23);
		expect(leer('hermanos')).toBeNull();
	});
});

describe('detectarDichas', () => {
	it('une «Santiago capítulo uno» con el «versículo dos» que llega en otro fragmento', () => {
		const refs = detectarDichas([
			frag(10, 356, 'Santiago capítulo uno eh hay una'),
			frag(11, 369, 'hay una expresión muy muy válida del sentido de la tentación,'),
			frag(12, 383, 'en en el versículo dos dice hermanos míos tened por sumo gozo')
		]);
		expect(refs).toEqual([
			{
				libro: 'Santiago',
				capitulo: 1,
				versiculoInicio: 2,
				versiculoFin: null,
				fragmentoId: 10,
				momentoMs: 356_000
			}
		]);
	});

	it('entiende ordinales, rangos y cifras', () => {
		const refs = detectarDichas([
			frag(1, 0, 'Leamos primera de Corintios capítulo trece versículo cuatro al siete.'),
			frag(2, 20, 'Y en Juan 3 16 dice que de tal manera amó Dios al mundo.'),
			frag(3, 40, 'Como dice Filipenses cuatro ocho, todo lo que es verdadero.')
		]);
		expect(formatos(refs)).toEqual(['1 Corintios 13:4-7', 'Juan 3:16', 'Filipenses 4:8']);
	});

	it('no confunde nombres de personas con libros', () => {
		const refs = detectarDichas([
			frag(1, 0, 'Juan dos veces vino a la iglesia y Daniel tres años después.'),
			frag(2, 20, 'Los hechos dos semanas antes fueron claros. Santiago es una ciudad.')
		]);
		expect(refs).toEqual([]);
	});

	it('descarta referencias imposibles', () => {
		expect(detectarDichas([frag(1, 0, 'Santiago capítulo nueve versículo cuatro')])).toEqual([]);
	});
});

describe('detectarEscritas', () => {
	it('lee varias referencias de una diapositiva y heredan el libro', () => {
		expect(
			formatos(detectarEscritas('ES APORTAR PRINCIPIOS Deuteronomio 6:6-9; 11:18-20'))
		).toEqual(['Deuteronomio 6:6-9', 'Deuteronomio 11:18-20']);
	});

	it('lee ordinales, capítulos solos y nombres sin tilde', () => {
		expect(formatos(detectarEscritas('1 Juan 4:8 · Salmo 23 · Genesis 1:1'))).toEqual([
			'1 Juan 4:8',
			'Salmos 23',
			'Génesis 1:1'
		]);
	});
});
