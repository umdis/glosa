import { describe, expect, it } from 'vitest';
import { enlaceYoutube, youtubeEnMinuto } from '../youtube';
import { consultarYoutube } from './youtube';

describe('enlaceYoutube', () => {
	it('acepta las formas habituales y devuelve el enlace canónico', () => {
		const canonico = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
		for (const e of [
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			'https://youtube.com/watch?v=dQw4w9WgXcQ&list=x&t=40',
			'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
			'https://youtu.be/dQw4w9WgXcQ?si=abc',
			'https://www.youtube.com/live/dQw4w9WgXcQ',
			'https://www.youtube.com/shorts/dQw4w9WgXcQ',
			'  http://www.youtube.com/embed/dQw4w9WgXcQ  '
		])
			expect(enlaceYoutube(e), e).toBe(canonico);
	});

	it('rechaza otros hosts, hosts parecidos, credenciales, puertos e ids raros', () => {
		for (const e of [
			'https://vimeo.com/123',
			'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
			'https://evil.com/?u=https://youtu.be/dQw4w9WgXcQ',
			'https://user:pw@youtube.com/watch?v=dQw4w9WgXcQ',
			'https://youtube.com:8080/watch?v=dQw4w9WgXcQ',
			'javascript:alert(1)//youtube.com',
			'https://www.youtube.com/watch?v=corto',
			'https://www.youtube.com/channel/UC123',
			'no es un enlace'
		])
			expect(enlaceYoutube(e), e).toBeNull();
	});

	it('el mismo video en un minuto', () => {
		expect(youtubeEnMinuto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 750.9)).toBe(
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=750s'
		);
	});
});

describe('consultarYoutube', () => {
	it('un enlace ajeno no hace ninguna petición', async () => {
		let pedidas = 0;
		const pedir = (async () => {
			pedidas++;
			return new Response('{}');
		}) as unknown as typeof fetch;
		const r = await consultarYoutube('https://vimeo.com/1', pedir);
		expect(r.ok).toBe(false);
		expect(pedidas).toBe(0);
	});

	it('pide oEmbed con el enlace canónico y devuelve título, canal y miniatura', async () => {
		let pedida = '';
		const pedir = (async (url: string) => {
			pedida = url;
			return new Response(
				JSON.stringify({
					title: 'Criar hijos',
					author_name: 'Iglesia',
					thumbnail_url: 'https://i.ytimg.com/x.jpg'
				})
			);
		}) as unknown as typeof fetch;
		const r = await consultarYoutube('https://youtu.be/dQw4w9WgXcQ', pedir);
		expect(pedida).toBe(
			'https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&format=json'
		);
		expect(r).toEqual({
			ok: true,
			datos: {
				url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
				titulo: 'Criar hijos',
				canal: 'Iglesia',
				miniatura: 'https://i.ytimg.com/x.jpg'
			}
		});
	});

	it('un video privado o inexistente da un motivo claro', async () => {
		const con = (estado: number) =>
			(async () => new Response('Unauthorized', { status: estado })) as unknown as typeof fetch;
		expect(await consultarYoutube('https://youtu.be/dQw4w9WgXcQ', con(401))).toMatchObject({
			ok: false,
			error: 'That video is private or cannot be embedded.'
		});
		expect(await consultarYoutube('https://youtu.be/dQw4w9WgXcQ', con(404))).toMatchObject({
			ok: false,
			error: 'YouTube does not know that video.'
		});
	});
});
