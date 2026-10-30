import { describe, expect, it } from 'vitest';
import { agruparEtapas, trazaDeRespuesta, type PasoAgente } from './traza';

const buscar = (detalle: string, resultados = 3): PasoAgente => ({
	tipo: 'herramienta',
	herramienta: 'buscar',
	detalle,
	resultados
});
const leer: PasoAgente = {
	tipo: 'herramienta',
	herramienta: 'leer_fragmentos',
	detalle: 'Devocional',
	resultados: 5
};
const estados = (pasos: PasoAgente[], trabajando: boolean) =>
	agruparEtapas(pasos, trabajando).map((e) => e.estado);

describe('agruparEtapas', () => {
	it('antes del primer paso, el modelo está decidiendo qué buscar', () => {
		expect(estados([], true)).toEqual(['activa', 'pendiente', 'pendiente', 'pendiente']);
	});

	it('mientras lee, buscar queda hecha y leer activa', () => {
		expect(estados([buscar('fe'), leer], true)).toEqual([
			'hecha',
			'activa',
			'pendiente',
			'pendiente'
		]);
	});

	it('si pasó a redactar sin leer, leer queda omitida y no hecha', () => {
		const pasos: PasoAgente[] = [buscar('fe'), { tipo: 'redactar', fragmentos: 3 }];
		expect(estados(pasos, true)).toEqual(['hecha', 'omitida', 'activa', 'pendiente']);
	});

	it('al terminar sin evidencia, redactar y verificar quedan omitidas', () => {
		expect(estados([buscar('astronomía', 0)], false)).toEqual([
			'hecha',
			'omitida',
			'omitida',
			'omitida'
		]);
	});

	it('cada etapa conserva sus pasos en orden', () => {
		const etapas = agruparEtapas([buscar('fe'), leer, buscar('prueba')], true);
		expect(etapas[0].pasos.map((p) => (p.tipo === 'herramienta' ? p.detalle : ''))).toEqual([
			'fe',
			'prueba'
		]);
		expect(etapas[0].estado).toBe('activa');
	});
});

describe('trazaDeRespuesta', () => {
	it('solo lo que la respuesta conserva: consultas sin cifras y la verificación', () => {
		const pasos = trazaDeRespuesta({
			busquedas: ['tentación'],
			sinEvidencia: false,
			afirmaciones: [{ citas: [{ estado: 'verificada' }, { estado: 'no_verificada' }] }]
		});
		expect(pasos).toEqual([
			{ tipo: 'herramienta', herramienta: 'buscar', detalle: 'tentación', resultados: -1 },
			{ tipo: 'redactar', fragmentos: -1 },
			{ tipo: 'verificar', citas: 2, verificadas: 1 }
		]);
	});

	it('lo que la respuesta no conserva queda «sin registro», nunca «omitido»', () => {
		const pasos = trazaDeRespuesta({
			busquedas: ['fe'],
			sinEvidencia: false,
			afirmaciones: [{ citas: [{ estado: 'verificada' }] }]
		});
		expect(agruparEtapas(pasos, false, false).map((e) => e.estado)).toEqual([
			'hecha',
			'sin-registro',
			'hecha',
			'hecha'
		]);
	});
});
