import { describe, expect, it } from 'vitest';
import { leerConfig } from './config';

describe('leerConfig', () => {
	it('usa valores por defecto seguros', () => {
		expect(leerConfig({})).toEqual({
			dataDir: './data',
			modelApiKey: undefined,
			adminToken: undefined,
			topeGastoDiarioUsd: 5
		});
	});

	it('rechaza un tope de gasto inválido', () => {
		expect(() => leerConfig({ DAILY_SPEND_CAP_USD: 'mucho' })).toThrow(/DAILY_SPEND_CAP_USD/);
		expect(() => leerConfig({ DAILY_SPEND_CAP_USD: '-1' })).toThrow();
	});
});
