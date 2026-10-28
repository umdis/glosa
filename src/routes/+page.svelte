<script lang="ts">
	import { duracion } from '#lib/formato.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Glosa — Turn footage into footnotes</title>
	<meta
		name="description"
		content="Search hours of video by what was said, and cite the exact moment."
	/>
</svelte:head>

<div class="portada">
	<h1>Glosa</h1>
	<p class="lema">Turn footage into footnotes.</p>

	<form class="buscar" action="/search" method="get" role="search">
		<label for="buscar-portada">Search what was said in every video</label>
		<div class="fila">
			<input id="buscar-portada" name="q" type="search" autocomplete="off" />
			<button type="submit">Search</button>
		</div>
	</form>
	<p class="preguntar">
		Or <a href={resolve('/ask')}>ask the collection a question</a> and get an answer built from verified
		quotes.
	</p>

	<section class="indice" aria-labelledby="titulo-indice">
		<h2 id="titulo-indice">The collection</h2>
		{#if data.videos.length === 0}
			<p class="vacio">No videos yet. Once a video is uploaded and transcribed, it appears here.</p>
		{:else}
			<ol>
				{#each data.videos as video (video.id)}
					<li>
						<a href={resolve('/videos/[id]', { id: video.id })}>{video.titulo}</a>
						<span class="relleno" aria-hidden="true"></span>
						<span class="duracion">{duracion(video.duracionMs)}</span>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
</div>

<style>
	.portada {
		max-width: calc(var(--medida) + 12rem);
		margin: 0 auto;
		padding: clamp(3rem, 12vh, 8rem) var(--margen) 4rem;
	}

	h1 {
		font-size: var(--t-5);
		font-style: italic;
		font-weight: 500;
		letter-spacing: -0.01em;
	}

	.lema {
		font-size: var(--t-2);
		color: var(--suave);
		margin: 0.25rem 0 3rem;
	}

	.buscar label {
		display: block;
		font-family: var(--letra-interfaz);
		font-size: var(--t-1);
		margin-bottom: 0.4rem;
	}

	.fila {
		display: flex;
		gap: 0.5rem;
	}

	.fila input {
		flex: 1;
		min-width: 0;
		font-size: var(--t-2);
	}

	.preguntar {
		font-family: var(--letra-interfaz);
		color: var(--suave);
		margin: 1rem 0 0;
	}

	.preguntar a {
		color: var(--tinta);
	}

	.indice {
		margin-top: 4rem;
	}

	h2 {
		font-size: var(--t-2);
		margin-bottom: 1rem;
	}

	/* Índice como la tabla de un códice: título, puntos guía y duración alineada a la derecha. */
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.45rem 0;
		font-size: var(--t-1);
	}

	.relleno {
		flex: 1;
		border-bottom: 2px dotted var(--pauta);
		transform: translateY(-0.3em);
		min-width: 1.5rem;
	}

	.duracion {
		color: var(--suave);
		font-variant-numeric: lining-nums tabular-nums;
	}

	.vacio {
		color: var(--suave);
	}
</style>
