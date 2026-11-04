<script lang="ts">
	import { resolve } from '$app/paths';
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import { folio } from '#lib/formato.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const e = $derived(data.etiqueta);
</script>

<svelte:head>
	<title>{e.nombre} — Topics — Glosa</title>
</svelte:head>

<div class="pagina">
	<header class="encabezado">
		<p class="miga"><a href={resolve('/topics')}>Topics</a></p>
		<h1 lang="es">{e.nombre}</h1>
	</header>

	<form class="buscar tarjeta" method="get" action={resolve('/search')}>
		<input type="hidden" name="tag" value={e.slug} />
		<label for="buscar-tema">Search only the videos on <span lang="es">“{e.nombre}”</span></label>
		<div class="fila">
			<input id="buscar-tema" name="q" type="search" maxlength="200" required />
			<button type="submit" class="boton">Search</button>
		</div>
	</form>

	<ul class="videos">
		{#each e.videos as v (v.id)}
			<li class="tarjeta">
				<Fotograma videoId={v.id} segundo={60} clase="portada" />
				<h2 lang="es"><a href={resolve('/videos/[id]', { id: v.id })}>{v.titulo}</a></h2>
				{#if v.duracionMs}<p class="duracion">{folio(v.duracionMs)}</p>{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.pagina {
		display: grid;
		gap: var(--e-8);
		max-width: 68rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) var(--e-16);
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
	}

	.miga,
	.duracion {
		color: var(--suave);
	}

	.buscar {
		display: grid;
		padding: var(--e-4) var(--e-6);
		gap: var(--e-2);
		max-width: 44rem;
	}

	.buscar label {
		font-weight: 700;
	}

	.fila {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
	}

	.fila input {
		flex: 1 1 16rem;
		min-height: 2.75rem;
	}

	.videos {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
		gap: var(--e-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.videos li {
		display: grid;
		padding: var(--e-3) var(--e-4);
		overflow: hidden;
		gap: var(--e-2);
		align-content: start;
	}

	.videos :global(.portada) {
		margin: calc(var(--e-3) * -1) calc(var(--e-4) * -1) var(--e-2);
		border-radius: var(--radio-m) var(--radio-m) 0 0;
	}

	h2 {
		font-size: var(--t-2);
	}

	.duracion {
		font-size: var(--t-0);
	}
</style>
