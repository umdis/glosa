import { describe, expect, it } from 'vitest';
import { borradorEstudio, markdownImprimible } from './estudio';

const respuesta = {
	pregunta: '¿Qué produce la prueba de la fe?',
	afirmaciones: [
		{
			texto: 'La prueba de la fe produce paciencia.',
			respaldo: 'respaldada',
			citas: [
				{
					estado: 'verificada',
					frase: 'la prueba de vuestra fe produce paciencia',
					videoId: 'v1',
					titulo: 'Devocional',
					inicioMs: 402_500,
					fragmentoId: 7
				},
				{ estado: 'no_verificada', frase: 'algo que nadie dijo', fragmentoId: 8 }
			]
		},
		{ texto: 'Lutero clavó 95 tesis.', respaldo: 'sin_respaldo', citas: [] }
	]
};

describe('borradorEstudio', () => {
	it('incluye solo afirmaciones respaldadas y citas verificadas, con enlace al momento', () => {
		const md = borradorEstudio(respuesta, 'https://glosa.example');
		expect(md).toContain('# ¿Qué produce la prueba de la fe?');
		expect(md).toContain('> «la prueba de vuestra fe produce paciencia»');
		expect(md).toContain('[Devocional, 6:42](https://glosa.example/videos/v1?t=402#f-7)');
		expect(md).not.toContain('algo que nadie dijo');
		expect(md).not.toContain('Lutero');
	});
});

describe('markdownImprimible', () => {
	it('convierte títulos, citas, enlaces y párrafos', () => {
		const html = markdownImprimible(borradorEstudio(respuesta, 'https://glosa.example'));
		expect(html).toContain('<h1>¿Qué produce la prueba de la fe?</h1>');
		expect(html).toContain('<blockquote>«la prueba de vuestra fe produce paciencia»<br>');
		expect(html).toContain(
			'<a href="https://glosa.example/videos/v1?t=402#f-7">Devocional, 6:42</a>'
		);
		expect(html).toContain(
			'<em>Every quote was checked against the video transcript with Glosa.</em>'
		);
	});

	it('escapa el HTML que escriba la persona y no admite enlaces javascript:', () => {
		const html = markdownImprimible('<img src=x onerror=alert(1)>\n\n[clic](javascript:alert(1))');
		expect(html).not.toContain('<img');
		expect(html).toContain('&lt;img');
		expect(html).not.toContain('href="javascript');
	});
});
