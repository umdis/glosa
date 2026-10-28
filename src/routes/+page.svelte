<script lang="ts">
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import { duracion, folio } from '#lib/formato.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const enlaceVideo = (id: string, ms: number) =>
		resolve(`/videos/[id]?t=${Math.floor(ms / 1000)}`, { id });
	const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
</script>

<svelte:head>
	<title>Glosa — Turn footage into footnotes</title>
	<meta
		name="description"
		content="Search hours of video by what was said, and cite the exact moment."
	/>
</svelte:head>

<div class="portada">
	<section class="heroe" aria-labelledby="lema">
		<div class="reclamo">
			<h1 id="lema">Turn footage into footnotes.</h1>
			<p class="bajada">
				Search hours of video by what was said, ask questions answered with verified quotes, and
				cite the exact minute.
			</p>

			<form class="buscar" action="/search" method="get" role="search">
				<label for="buscar-portada">Search what was said in every video</label>
				<div class="fila">
					<div class="campo-buscar">
						<svg viewBox="0 0 20 20" aria-hidden="true"
							><circle
								cx="8.5"
								cy="8.5"
								r="5.5"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
							/><path
								d="M13 13l4.5 4.5"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
							/></svg
						>
						<input
							id="buscar-portada"
							name="q"
							type="search"
							autocomplete="off"
							aria-keyshortcuts="/"
							data-atajo-buscar
						/>
					</div>
					<button type="submit">Search</button>
				</div>
			</form>

			{#if data.sugerencias.length}
				<div class="sugerencias">
					<span id="t-sugerencias">Try</span>
					<ul aria-labelledby="t-sugerencias">
						{#each data.sugerencias as s (s)}
							<li>
								<a class="chip" href={resolve(`/search?q=${encodeURIComponent(s)}`)} lang="es"
									>{s}</a
								>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<p class="preguntar">
				<a class="boton secundario" href={resolve('/ask')}>Ask the collection a question</a>
			</p>
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
					<aside class="glosa" aria-label="Scripture reference">
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
					</aside>
				</div>
				<figcaption id="t-especimen">
					From <a href={resolve('/videos/[id]', { id: e.videoId })} lang="es">{e.titulo}</a>. Every
					reference links to the minute it was said.
				</figcaption>
			</figure>
		{/if}
	</section>

	{#if data.cifras.videos > 0}
		<p class="cifras">
			{plural(data.cifras.videos, 'video', 'videos')}, {duracion(data.cifras.duracionMs)} of recordings
			and {plural(data.cifras.pasajes, 'Scripture reference', 'Scripture references')}, all
			searchable by what was said.
		</p>
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
				<strong>Glosa reads it.</strong> Meta's models transcribe every word and read the slides and whiteboard,
				minute by minute.
			</li>
			<li>
				<strong>Search, ask and cite.</strong> Every result and every quote links to the exact moment,
				checked against the transcript.
			</li>
		</ol>
	</section>
</div>

<style>
	.portada {
		max-width: 76rem;
		margin: 0 auto;
		padding: clamp(2rem, 8vh, 5rem) var(--margen) var(--e-16);
	}

	/* ── Héroe ── */
	.heroe {
		display: grid;
		gap: var(--e-12);
		align-items: center;
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
		color: var(--suave);
		font-size: var(--t-2);
		line-height: 1.4;
	}

	.buscar label {
		display: block;
		margin-bottom: var(--e-2);
		font-family: var(--letra-interfaz);
	}

	.fila {
		display: flex;
		gap: var(--e-2);
	}

	.fila .campo-buscar {
		flex: 1;
		min-width: 0;
	}

	.fila input {
		min-height: 3.25rem;
		font-size: var(--t-2);
		box-shadow: var(--sombra-1);
	}

	.fila button {
		min-height: 3.25rem;
	}

	.sugerencias {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2) var(--e-3);
		margin-top: var(--e-4);
		font-family: var(--letra-interfaz);
		color: var(--suave);
	}

	.sugerencias ul {
		display: contents;
		list-style: none;
	}

	.preguntar {
		margin: var(--e-8) 0 0;
	}

	/* ── Espécimen: una hoja con su folio, la frase y la glosa al margen ── */
	.especimen {
		margin: 0;
	}

	.hoja {
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
		color: var(--suave);
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

	/* ── Cifras ── */
	.cifras {
		max-width: 44rem;
		margin: var(--e-16) 0 0;
		padding-top: var(--e-6);
		border-top: 1px solid var(--linea);
		font-size: var(--t-2);
		line-height: 1.4;
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
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
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
