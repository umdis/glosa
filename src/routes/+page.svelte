<script lang="ts">
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import { duracion, folio } from '#lib/formato.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const enlaceVideo = (id: string, ms: number) =>
		resolve(`/videos/[id]?t=${Math.floor(ms / 1000)}`, { id });
	const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

	let pregunta = $state('');
	/**
	 * Con JavaScript, «Ask» lleva a /ask con estado de navegación y la pregunta empieza allí, con su
	 * traza en vivo. Sin él, el GET solo rellena el campo: un enlace nunca gasta una pregunta (D4).
	 */
	function preguntar(evento: SubmitEvent) {
		if (pregunta.trim().length < 3) return;
		evento.preventDefault();
		// La ruta sí pasa por resolve(); la regla no reconoce la consulta pegada detrás.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve('/ask') + ?q=
		goto(`${resolve('/ask')}?q=${encodeURIComponent(pregunta.trim())}`, {
			state: { preguntar: true }
		});
	}
</script>

<svelte:head>
	<title>Glosa — Turn footage into footnotes</title>
	<meta
		name="description"
		content="Search hours of video by what was said, and cite the exact moment."
	/>
</svelte:head>

<div class="portada">
	<!-- La lámina: la única superficie oscura de la portada, para lo que Glosa hace mejor. -->
	<div class="banda">
		<section class="heroe" aria-labelledby="lema">
			<div class="reclamo">
				<h1 id="lema">Turn footage into footnotes.</h1>
				<p class="bajada">
					Ask hours of sermons a question. A Muse Spark agent answers with quotes, and every quote
					links to the minute it was said.
				</p>

				<form class="preguntar" action={resolve('/ask')} method="get" onsubmit={preguntar}>
					<label for="pregunta-portada">Ask the collection</label>
					<div class="fila">
						<input
							id="pregunta-portada"
							name="q"
							type="text"
							required
							minlength="3"
							maxlength="300"
							autocomplete="off"
							bind:value={pregunta}
						/>
						<button type="submit">Ask</button>
					</div>
				</form>

				{#if data.ejemplos.length}
					<div class="ejemplos">
						<span id="t-ejemplos">Try</span>
						<ul aria-labelledby="t-ejemplos">
							{#each data.ejemplos as e (e)}
								<li>
									<a class="chip" href="{resolve('/ask')}?q={encodeURIComponent(e)}" lang="es"
										>{e}</a
									>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			{#if data.especimen}
				{@const e = data.especimen}
				<!-- El espécimen: una frase real de la colección con su glosa al margen. -->
				<figure class="especimen" aria-labelledby="t-especimen">
					<div class="hoja">
						<a
							class="folio"
							href={enlaceVideo(e.videoId, e.fragmentoMs)}
							aria-label="Play from {folio(e.fragmentoMs)}">{folio(e.fragmentoMs)}</a
						>
						<p class="dicho" lang="es">{e.texto}</p>
						<div class="glosa" role="note" aria-label="Scripture reference">
							<Fotograma videoId={e.videoId} segundo={e.momentoMs / 1000} clase="cuadro" />
							<p class="referencia" lang="es">{e.referencia}</p>
							<p class="rotulo">
								Said at <a class="folio" href={enlaceVideo(e.videoId, e.momentoMs)}
									>¶ {folio(e.momentoMs)}</a
								>
							</p>
							<p class="sello">
								<svg viewBox="0 0 16 16" aria-hidden="true"
									><circle cx="8" cy="8" r="6.5" /><path d="M5 8.2l2 2 4-4.4" /></svg
								>
								Checked against the canon
							</p>
						</div>
					</div>
					<figcaption id="t-especimen">
						From <a href={resolve('/videos/[id]', { id: e.videoId })} lang="es">{e.titulo}</a>.
						Every reference links to the minute it was said.
					</figcaption>
				</figure>
			{/if}
		</section>
	</div>

	{#if data.cifras.videos > 0}
		{@const c = data.cifras}
		<!-- El colofón: como al final de un manuscrito, quién hizo qué. Cifras reales de la base. -->
		<section class="colofon" aria-labelledby="t-colofon">
			<h2 id="t-colofon">Colophon</h2>
			<p>
				This collection holds {plural(c.videos, 'video', 'videos')} and {duracion(c.duracionMs)} of recordings.
				<strong>Muse Voice Transcribe</strong>
				wrote down every word with its time, in
				{plural(c.fragmentos, 'passage', 'passages')}.
				{#if c.enPantalla}<strong>Muse Spark</strong> read {plural(
						c.enPantalla,
						'slide or whiteboard',
						'slides and whiteboards'
					)} from the screen{#if c.retenidos}, and screened every passage for prayer requests that
						name people: {plural(c.retenidos, 'passage is', 'passages are')} held back until a person
						decides{/if}.{/if}
				Glosa found {plural(c.pasajes, 'Scripture reference', 'Scripture references')}, spoken or
				shown, and checks every quote an answer uses against the transcript before you see it.
			</p>
		</section>
	{/if}

	<section class="coleccion" aria-labelledby="t-coleccion">
		<h2 id="t-coleccion">The collection</h2>
		{#if data.videos.length === 0}
			<p class="vacio">
				No videos yet. Once a video is uploaded in the editor and transcribed, it appears here.
			</p>
		{:else}
			<ul class="videos">
				{#each data.videos as video (video.id)}
					<li class="video tarjeta">
						<div class="poster">
							<Fotograma
								videoId={video.id}
								segundo={video.posterSegundo}
								ancho={640}
								transicion="video-{video.id}"
							/>
							{#if video.duracionMs}<span class="insignia duracion"
									>{duracion(video.duracionMs)}</span
								>{/if}
						</div>
						<div class="ficha">
							<h3 lang="es">
								<a href={resolve('/videos/[id]', { id: video.id })}>{video.titulo}</a>
							</h3>
							{#if video.temas.length}
								<ul class="temas" aria-label="Topics" lang="es">
									{#each video.temas as tema (tema)}<li>{tema}</li>{/each}
								</ul>
							{/if}
							{#if video.pasajes}
								<p class="dato">
									{plural(video.pasajes, 'Scripture reference', 'Scripture references')}
								</p>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="como" aria-labelledby="t-como">
		<h2 id="t-como">How it works</h2>
		<ol>
			<li>
				<strong>Upload a recording.</strong> A sermon, a class, a talk: an mp4 is enough.
			</li>
			<li>
				<strong>Glosa reads it.</strong> Muse Voice Transcribe writes down every word; Muse Spark reads
				the slides and whiteboard, minute by minute.
			</li>
			<li>
				<strong>Search, ask and cite.</strong> Every result and every quote links to the exact moment,
				checked against the transcript.
			</li>
		</ol>
	</section>
</div>

<style>
	/* La banda ocupa todo el ancho; el resto de piezas, la medida de la portada. */
	.portada {
		padding-bottom: var(--e-16);
	}

	.portada > :not(.banda) {
		max-width: 76rem;
		margin-inline: auto;
		padding-inline: var(--margen);
	}

	/* ── Héroe sobre la lámina de tinta ── */
	.banda {
		padding: clamp(2.5rem, 8vh, 5.5rem) var(--margen) clamp(2.5rem, 7vh, 4.5rem);
		background: var(--lamina);
		color: var(--lamina-tinta);
	}

	.banda :focus-visible {
		outline-color: var(--lamina-tinta);
	}

	.heroe {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--e-12);
		align-items: center;
		max-width: 76rem;
		margin-inline: auto;
	}

	h1 {
		font-size: clamp(var(--t-4), 6vw, var(--t-6));
		font-style: italic;
		font-weight: 500;
		line-height: 1.02;
		letter-spacing: -0.015em;
	}

	.bajada {
		max-width: 30rem;
		margin: var(--e-4) 0 var(--e-8);
		color: var(--lamina-suave);
		font-size: var(--t-2);
		line-height: 1.4;
	}

	.preguntar label {
		display: block;
		margin-bottom: var(--e-2);
		font-family: var(--letra-interfaz);
		font-size: var(--t-1);
	}

	.fila {
		display: flex;
		gap: var(--e-2);
	}

	.fila input {
		flex: 1;
		min-width: 0;
		min-height: 3.5rem;
		border-color: var(--lamina-suave);
		font-family: var(--letra-texto);
		font-size: var(--t-2);
	}

	.fila button {
		min-height: 3.5rem;
		min-width: 6.5rem;
		border-color: var(--lamina-tinta);
		background: var(--lamina-tinta);
		color: var(--lamina);
	}

	.fila button:hover {
		background: color-mix(in srgb, var(--lamina-tinta) 88%, var(--lamina));
	}

	.ejemplos {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2) var(--e-3);
		margin-top: var(--e-4);
		font-family: var(--letra-interfaz);
		color: var(--lamina-suave);
	}

	.ejemplos ul {
		display: contents;
		list-style: none;
	}

	.ejemplos .chip {
		border-color: var(--lamina-suave);
		background: transparent;
		color: var(--lamina-tinta);
		text-align: left;
		line-height: 1.25;
	}

	.ejemplos .chip:hover {
		border-color: var(--lamina-tinta);
	}

	/* ── Espécimen: una hoja con su folio, la frase y la glosa al margen ── */
	.especimen {
		margin: 0;
	}

	.hoja {
		color: var(--tinta);
		display: grid;
		grid-template-columns: 3.25rem minmax(0, 1fr);
		column-gap: var(--e-4);
		row-gap: var(--e-6);
		padding: var(--e-8) var(--e-6);
		border-radius: var(--radio-l);
		background: var(--papel);
	}

	.hoja > .folio {
		justify-self: end;
		padding-top: 0.2rem;
		font-size: var(--t-0);
		text-decoration: none;
	}

	.dicho {
		margin: 0;
		font-size: var(--t-2);
		line-height: 1.5;
	}

	.hoja .glosa {
		grid-column: 2;
		max-width: 17rem;
	}

	.glosa :global(.cuadro) {
		margin: calc(var(--e-3) * -1) calc(var(--e-4) * -1) var(--e-3);
		border-radius: var(--radio-m) var(--radio-m) 0 0;
	}

	.referencia {
		font-family: var(--letra-texto);
		font-size: var(--t-2);
		font-style: italic;
		line-height: 1.2;
	}

	.glosa .rotulo .folio {
		font-size: var(--t-1);
	}

	.sello {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: var(--e-2);
		padding-top: var(--e-2);
		border-top: 1px solid var(--linea);
		color: var(--suave);
		font-size: var(--t-0);
	}

	.sello svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: var(--rubrica);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	figcaption {
		margin-top: var(--e-3);
		padding-left: calc(3.25rem + var(--e-4) + var(--e-6));
		color: var(--lamina-suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	@media (min-width: 64rem) {
		.heroe {
			grid-template-columns: minmax(0, 27rem) minmax(0, 1fr);
			gap: var(--e-12);
		}
	}

	/* La glosa sale al margen solo si la hoja tiene sitio para la frase y la nota a la vez. */
	.especimen {
		container-type: inline-size;
	}

	@container (min-width: 40rem) {
		.hoja {
			grid-template-columns: 3.25rem minmax(0, 1fr) 14rem;
			column-gap: var(--e-4);
			align-items: start;
			--hilo: 2.5rem;
			--hilo-punto: 1;
			--retardo: 500ms;
		}
		.hoja .dicho {
			margin-right: var(--e-8);
		}
		.hoja .glosa {
			grid-column: 3;
			margin-top: 2.5rem;
		}
	}

	/* ── Colofón: el rótulo al margen y el texto a la medida ── */
	.colofon {
		display: grid;
		gap: var(--e-2) var(--e-12);
		margin-top: var(--e-16);
	}

	.colofon p {
		max-width: 46rem;
		margin: 0;
		font-size: var(--t-2);
		line-height: 1.5;
	}

	.colofon strong {
		font-style: italic;
		font-weight: 600;
	}

	@media (min-width: 52rem) {
		.colofon {
			grid-template-columns: 12rem minmax(0, 1fr);
		}
		.colofon h2 {
			margin: 0.2rem 0 0;
		}
	}

	/* ── Colección ── */
	.coleccion {
		margin-top: var(--e-16);
	}

	h2 {
		margin-bottom: var(--e-6);
		font-size: var(--t-3);
		font-style: italic;
	}

	.videos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		gap: var(--e-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.video {
		position: relative;
		overflow: hidden;
	}

	.poster {
		position: relative;
		border-radius: var(--radio-m) var(--radio-m) 0 0;
		overflow: hidden;
	}

	.poster .duracion {
		position: absolute;
		right: var(--e-3);
		bottom: var(--e-3);
		background: var(--papel-alto);
		color: var(--tinta);
	}

	.ficha {
		padding: var(--e-4) var(--e-6) var(--e-6);
	}

	h3 {
		font-size: var(--t-2);
		line-height: 1.2;
	}

	/* Un solo enlace por tarjeta, que cubre toda la pieza. */
	h3 a {
		text-decoration: none;
	}
	h3 a::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--radio-m);
	}
	h3 a:focus-visible {
		outline: none;
	}
	h3 a:focus-visible::after {
		outline: 3px solid var(--tinta);
		outline-offset: 3px;
	}
	.video:hover h3 a {
		text-decoration: underline;
	}

	.temas {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem var(--e-4);
		margin: var(--e-2) 0 0;
		padding: 0;
		list-style: none;
		color: var(--suave);
		font-family: var(--letra-interfaz);
	}

	.temas li::before {
		content: '§ ';
	}

	.dato,
	.vacio {
		margin: var(--e-2) 0 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
	}

	/* ── Cómo funciona: una secuencia real, por eso va numerada ── */
	.como {
		margin-top: var(--e-16);
	}

	.como ol {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		gap: var(--e-6) var(--e-8);
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: paso;
	}

	.como li {
		counter-increment: paso;
		padding-top: var(--e-4);
		border-top: 1px solid var(--suave);
		color: var(--suave);
		font-family: var(--letra-interfaz);
	}

	.como li::before {
		content: counter(paso);
		display: block;
		margin-bottom: var(--e-2);
		color: var(--tinta);
		font-family: var(--letra-texto);
		font-size: var(--t-3);
		font-style: italic;
		font-variant-numeric: lining-nums;
		line-height: 1;
	}

	.como strong {
		color: var(--tinta);
		font-weight: 500;
	}

	@media (prefers-reduced-motion: no-preference) {
		.video {
			transition:
				box-shadow var(--dur-corta) var(--curva),
				transform var(--dur-corta) var(--curva);
		}
		.video:hover {
			box-shadow: var(--sombra-2);
			transform: translateY(-2px);
		}
	}
</style>
