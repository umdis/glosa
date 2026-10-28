import { describe, expect, it } from 'vitest';
import { leerConfig, mostrarFotogramas } from './config';

describe('leerConfig', () => {
	it('usa valores por defecto seguros', () => {
		expect(leerConfig({})).toEqual({
			dataDir: './data',
			modelApiKey: undefined,
			adminToken: undefined,
			topeGastoDiarioUsd: 5,
			mostrarFotogramas: true
		});
	});

	it('rechaza un tope de gasto inválido', () => {
		expect(() => leerConfig({ DAILY_SPEND_CAP_USD: 'mucho' })).toThrow(/DAILY_SPEND_CAP_USD/);
		expect(() => leerConfig({ DAILY_SPEND_CAP_USD: '-1' })).toThrow();
	});
});

describe('mostrarFotogramas', () => {
	it('solo se apaga con un valor explícito', () => {
		expect(mostrarFotogramas(undefined)).toBe(true);
		expect(mostrarFotogramas('')).toBe(true);
		expect(mostrarFotogramas('true')).toBe(true);
		for (const apagado of ['false', '0', 'no', 'OFF', ' False ']) {
			expect(mostrarFotogramas(apagado)).toBe(false);
		}
	});
});
