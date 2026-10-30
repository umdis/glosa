import { describe, expect, it } from 'vitest';
import { abrirBase } from '../db/base';
import type { CuerpoChat, RespuestaChat } from '../meta/cliente';
import { idiomaValido, leerTraducciones, traducir } from './traducir';

/** Cliente que traduce poniendo «EN:» delante y cuenta las llamadas y las líneas recibidas. */
function clienteTraductor() {
	const lotes: string[][] = [];
	return {
		lotes,
		chat: async (cuerpo: CuerpoChat): Promise<RespuestaChat> => {
			const lineas = String(cuerpo.messages.at(-1)?.content ?? '').split('\n');
			lotes.push(lineas);
			const traducciones = lineas.map((l) => {
				const [, n, texto] = /^(\d+)\. (.*)$/.exec(l)!;
				return { n: Number(n), texto: `EN: ${texto}` };
			});
			return {
				choices: [
					{
						finish_reason: 'stop',
						message: { role: 'assistant', content: JSON.stringify({ traducciones }) }
					}
				]
			};
		}
	};
}

describe('traducir', () => {
	it('traduce, guarda y no vuelve a pedir lo ya traducido', async () => {
		const db = abrirBase(':memory:');
		const cliente = clienteTraductor();
		const primera = await traducir(db, cliente, ['hermanos míos', 'tened gozo'], 'en');
		expect(primera.get('hermanos míos')).toBe('EN: hermanos míos');

		const segunda = await traducir(db, cliente, ['tened gozo', 'la prueba'], 'en');
		expect(segunda.get('tened gozo')).toBe('EN: tened gozo');
		// La segunda vez solo viajó lo que faltaba.
		expect(cliente.lotes).toHaveLength(2);
		expect(cliente.lotes[1]).toEqual(['1. la prueba']);
	});

	it('parte en lotes de 80 y empareja cada número con su original', async () => {
		const db = abrirBase(':memory:');
		const cliente = clienteTraductor();
		const textos = Array.from({ length: 170 }, (_, i) => `frase ${i}`);
		const salida = await traducir(db, cliente, textos, 'en');
		expect(cliente.lotes.map((l) => l.length)).toEqual([80, 80, 10]);
		expect(salida.get('frase 169')).toBe('EN: frase 169');
	});

	it('lo que el modelo no devuelve queda sin traducción, sin inventar', async () => {
		const db = abrirBase(':memory:');
		const cliente = {
			chat: async (): Promise<RespuestaChat> => ({
				choices: [
					{
						finish_reason: 'stop',
						message: {
							role: 'assistant',
							content: JSON.stringify({
								traducciones: [
									{ n: 2, texto: 'two' },
									{ n: 9, texto: 'x' }
								]
							})
						}
					}
				]
			})
		};
		const salida = await traducir(db, cliente, ['uno', 'dos'], 'en');
		expect([...salida]).toEqual([['dos', 'two']]);
	});
});

describe('idiomaValido y leerTraducciones', () => {
	it('solo acepta códigos de dos letras', () => {
		expect(idiomaValido('en')).toBe('en');
		expect(idiomaValido('English')).toBeNull();
		expect(idiomaValido('../es')).toBeNull();
	});

	it('descarta lo mal formado', () => {
		expect(leerTraducciones('no es json')).toEqual([]);
		expect(
			leerTraducciones('{"traducciones":[{"n":"1","texto":"a"},{"n":2,"texto":"b"}]}')
		).toEqual([{ n: 2, texto: 'b' }]);
	});
});
