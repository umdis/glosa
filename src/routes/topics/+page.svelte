<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
</script>

<svelte:head>
	<title>Topics — Glosa</title>
</svelte:head>

<div class="pagina">
	<header class="encabezado">
		<h1>Topics</h1>
		<p class="nota">
			The topics of each video, proposed by Muse Spark and approved by the editor. Pick one to see
			its videos, or to search only inside them. Videos grouped by the editor are under
			<a href={resolve('/series')}>Series</a>.
		</p>
	</header>

	{#if data.etiquetas.length === 0}
		<p class="nota">No topics have been approved yet.</p>
	{:else}
		<ul class="etiquetas">
			{#each data.etiquetas as e (e.id)}
				<li>
					<a class="chip" href={resolve('/topics/[slug]', { slug: e.slug })}
						><span lang="es">{e.nombre}</span>
						<span class="cuantos">{plural(e.videos.length, 'video', 'videos')}</span></a
					>
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

	.etiquetas {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.cuantos {
		color: var(--suave);
		font-size: var(--t-0);
	}
</style>
