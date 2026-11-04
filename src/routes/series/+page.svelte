<script lang="ts">
	import { resolve } from '$app/paths';
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
</script>

<svelte:head>
	<title>Series — Glosa</title>
</svelte:head>

<div class="pagina">
	<header class="encabezado">
		<h1>Series</h1>
		<p class="nota">
			Videos the editor grouped together. Open a series to watch its videos in order or to ask a
			question that only its videos can answer. Looking for a subject instead?
			<a href={resolve('/topics')}>Browse the topics</a>.
		</p>
	</header>

	{#if data.series.length === 0}
		<p class="nota">The editor has not grouped any videos into a series yet.</p>
	{:else}
		<ul class="lista">
			{#each data.series as s (s.id)}
				<li class="tarjeta">
					{#if s.videos[0]}
						<Fotograma videoId={s.videos[0].id} segundo={60} clase="portada" />
					{/if}
					<h2 lang="es"><a href={resolve('/series/[id]', { id: s.id })}>{s.nombre}</a></h2>
					<p class="cuenta">{plural(s.videos.length, 'video', 'videos')}</p>
					{#if s.descripcion}<p class="descripcion" lang="es">{s.descripcion}</p>{/if}
				</li>
			{/each}
		</ul>
	{/if}
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

	.nota {
		color: var(--suave);
		max-width: var(--medida);
	}

	.lista {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
		gap: var(--e-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.lista li {
		display: grid;
		padding: var(--e-3) var(--e-4);
		overflow: hidden;
		gap: var(--e-2);
		align-content: start;
	}

	.lista :global(.portada) {
		margin: calc(var(--e-3) * -1) calc(var(--e-4) * -1) var(--e-2);
		border-radius: var(--radio-m) var(--radio-m) 0 0;
	}

	h2 {
		font-size: var(--t-2);
	}

	.cuenta {
		color: var(--suave);
		font-size: var(--t-0);
	}

	.descripcion {
		font-family: var(--letra-texto);
	}
</style>
