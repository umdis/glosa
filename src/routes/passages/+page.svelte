<script lang="ts">
	import { resolve } from '$app/paths';
	import { folio } from '#lib/formato.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const referencia = (p: {
		capitulo: number;
		versiculoInicio: number | null;
		versiculoFin: number | null;
	}) =>
		p.versiculoInicio === null
			? `${p.capitulo}`
			: `${p.capitulo}:${p.versiculoInicio}${p.versiculoFin && p.versiculoFin !== p.versiculoInicio ? `–${p.versiculoFin}` : ''}`;
	const enlace = (videoId: string, momentoMs: number) =>
		resolve(`/videos/[id]?t=${Math.floor(momentoMs / 1000)}`, { id: videoId });
</script>

<svelte:head>
	<title>Scripture index — Glosa</title>
</svelte:head>

<div class="pagina">
	<h1>Scripture index</h1>
	<p class="nota">
		Every Bible passage cited in the collection, spoken or shown on screen, in canonical order. Each
		reference is checked against the real chapters and verses of its book.
	</p>

	{#if data.libros.length === 0}
		<p class="nota">No passages have been found in the transcribed videos yet.</p>
	{:else}
		<nav aria-label="Books" class="libros">
			<ul>
				{#each data.libros as l (l.libro)}
					<li><a href="#libro-{l.libro.replace(/\s/g, '-')}">{l.libro}</a></li>
				{/each}
			</ul>
		</nav>

		{#each data.libros as l (l.libro)}
			<section
				id="libro-{l.libro.replace(/\s/g, '-')}"
				aria-labelledby="h-{l.libro.replace(/\s/g, '-')}"
			>
				<h2 id="h-{l.libro.replace(/\s/g, '-')}" lang="es">{l.libro}</h2>
				<dl>
					{#each l.pasajes as p (referencia(p))}
						<dt lang="es">{l.libro} {referencia(p)}</dt>
						{#each p.momentos as m, i (i)}
							<dd>
								<a class="folio" href={enlace(m.videoId, m.momentoMs)}>¶ {folio(m.momentoMs)}</a>
								<span>{m.titulo}</span>
								{#if m.origen === 'en_pantalla'}<span class="origen">shown on screen</span>{/if}
							</dd>
						{/each}
					{/each}
				</dl>
			</section>
		{/each}
	{/if}
</div>

<style>
	.pagina {
		max-width: 52rem;
		margin: 0 auto;
		padding: 2.5rem var(--margen) 5rem;
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
	}

	.nota {
		color: var(--suave);
		max-width: var(--medida);
	}

	.libros ul {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.1rem;
		font-family: var(--letra-interfaz);
	}

	.libros a {
		display: inline-block;
		padding: 0.3rem 0;
	}

	section {
		margin-top: 2.5rem;
		scroll-margin-top: 1rem;
	}

	h2 {
		font-size: var(--t-3);
		margin-bottom: 0.75rem;
	}

	/* Como el índice de citas de una edición crítica: referencia a la izquierda, momentos a la derecha. */
	dl {
		display: grid;
		grid-template-columns: minmax(8rem, max-content) 1fr;
		column-gap: 1.5rem;
		row-gap: 0.35rem;
		margin: 0;
	}

	dt {
		grid-column: 1;
		font-weight: 500;
	}

	dd {
		grid-column: 2;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.75rem;
		align-items: baseline;
	}

	dt + dd {
		margin-top: 0;
	}

	.folio {
		text-decoration: none;
		min-width: 4.5rem;
	}

	.origen {
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
		color: var(--suave);
	}

	@media (max-width: 36rem) {
		dl {
			grid-template-columns: 1fr;
		}
		dt,
		dd {
			grid-column: 1;
		}
		dt {
			margin-top: 0.75rem;
		}
	}
</style>
