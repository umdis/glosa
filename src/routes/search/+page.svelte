<script lang="ts">
	import { concordancia, folio } from '#lib/formato.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const enVideos = $derived(
		data.grupos.length === 1 ? 'in 1 video' : `in ${data.grupos.length} videos`
	);
	const momentos = $derived(data.total === 1 ? '1 moment' : `${data.total} moments`);
</script>

<svelte:head>
	<title>{data.consulta ? `“${data.consulta}” — Glosa` : 'Search — Glosa'}</title>
</svelte:head>

<div class="pagina">
	{#if !data.consulta}
		<h1>Search what was said</h1>
		<p class="nota">Type a word or a phrase in the search box to find every moment it was said.</p>
	{:else if data.total === 0}
		<h1>Nothing found for “{data.consulta}”</h1>
		<p class="nota">
			No transcript contains those words. Try a single word, another form of it, or a shorter
			phrase.
		</p>
	{:else}
		<h1>“{data.consulta}”</h1>
		<p class="nota" role="status">{momentos} {enVideos}</p>

		{#each data.grupos as grupo (grupo.videoId)}
			<section class="grupo" aria-labelledby="g-{grupo.videoId}">
				<h2 id="g-{grupo.videoId}">
					<a href={resolve('/videos/[id]', { id: grupo.videoId })}>{grupo.titulo}</a>
				</h2>
				<ol class="concordancia" lang="es">
					{#each grupo.momentos as m (m.fragmentoId)}
						{@const c = concordancia(m.texto, m.marcas)}
						<li>
							<a
								class="folio"
								href="{resolve('/videos/[id]', { id: m.videoId })}?t={Math.floor(
									m.inicioMs / 1000
								)}#f-{m.fragmentoId}"
								aria-label="Play {grupo.titulo} from {folio(m.inicioMs)}"
								lang="en"><span aria-hidden="true">¶ </span>{folio(m.inicioMs)}</a
							>
							<span class="antes">{c.antes}</span>
							<span class="despues"
								>{#if c.clave}<mark>{c.clave}</mark>{/if}{c.despues}</span
							>
						</li>
					{/each}
				</ol>
			</section>
		{/each}
	{/if}
</div>

<style>
	.pagina {
		max-width: 64rem;
		margin: 0 auto;
		padding: 2.5rem var(--margen) 4rem;
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
	}

	.nota {
		color: var(--suave);
		font-family: var(--letra-interfaz);
		margin: 0.5rem 0 2.5rem;
		max-width: var(--medida);
	}

	.grupo + .grupo {
		margin-top: 2.5rem;
	}

	h2 {
		font-size: var(--t-2);
		margin-bottom: 0.75rem;
	}

	/*
	 * Concordancia: como en las concordancias bíblicas, todas las palabras buscadas empiezan en la
	 * misma vertical y el contexto se lee a ambos lados. El folio, en el margen, lleva al momento.
	 * Los bordes recortados se desvanecen: el corte es intencional, no un desborde.
	 */
	.concordancia {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr) minmax(0, 1.15fr);
		column-gap: 0.3rem;
		row-gap: 0.55rem;
	}

	.concordancia li {
		display: contents;
	}

	.folio {
		text-decoration: none;
		padding: 0.1rem 0;
	}

	.folio:hover {
		text-decoration: underline;
	}

	.antes,
	.despues {
		white-space: nowrap;
		overflow: hidden;
	}

	.antes {
		display: flex;
		justify-content: flex-end;
		mask-image: linear-gradient(to right, transparent, #000 3rem);
	}

	.despues {
		mask-image: linear-gradient(to left, transparent, #000 3rem);
	}

	/* En pantallas angostas la columna central no cabe: cada momento se lee como una línea corrida. */
	@media (max-width: 44rem) {
		.concordancia {
			display: block;
		}
		.concordancia li {
			display: block;
			margin-bottom: 1rem;
		}
		.folio {
			display: block;
		}
		.antes,
		.despues {
			display: inline;
			white-space: normal;
			mask-image: none;
		}
	}
</style>
