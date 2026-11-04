<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import { folio } from '#lib/formato.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const serie = $derived(data.serie);
	let pregunta = $state('');

	/** Igual que en la portada: con JavaScript la pregunta empieza en /ask; sin él, solo se rellena. */
	function preguntar(evento: SubmitEvent) {
		if (pregunta.trim().length < 3) return;
		evento.preventDefault();
		const consulta = `?serie=${encodeURIComponent(serie.id)}&q=${encodeURIComponent(pregunta.trim())}`;
		// La ruta sí pasa por resolve(); la regla no reconoce la consulta pegada detrás.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve('/ask') + consulta
		goto(`${resolve('/ask')}${consulta}`, { state: { preguntar: true } });
	}
</script>

<svelte:head>
	<title>{serie.nombre} — Series — Glosa</title>
</svelte:head>

<div class="pagina">
	<header class="encabezado">
		<p class="miga"><a href={resolve('/series')}>Series</a></p>
		<h1 lang="es">{serie.nombre}</h1>
		{#if serie.descripcion}<p class="nota" lang="es">{serie.descripcion}</p>{/if}
	</header>

	<!-- Preguntar dentro de la serie: va a /ask, que acota el agente a estos videos. -->
	<form class="preguntar tarjeta" method="get" action={resolve('/ask')} onsubmit={preguntar}>
		<input type="hidden" name="serie" value={serie.id} />
		<label for="pregunta-serie">Ask only this series</label>
		<div class="fila">
			<input
				id="pregunta-serie"
				name="q"
				type="text"
				minlength="3"
				maxlength="300"
				required
				bind:value={pregunta}
			/>
			<button type="submit" class="boton">Ask</button>
		</div>
		<p class="ayuda">
			Every quote in the answer will come from these {serie.videos.length} videos.
		</p>
	</form>

	{#if serie.resumen}
		<section class="resumen" aria-labelledby="t-resumen">
			<h2 id="t-resumen">About this series</h2>
			<p lang="es">{serie.resumen}</p>
			<p class="procedencia">
				Overview drafted by Muse Spark from the approved summaries of each video, and approved by
				the editor.
			</p>
		</section>
	{/if}

	<section aria-labelledby="t-videos">
		<h2 id="t-videos">Videos, in order</h2>
		{#if serie.videos.length === 0}
			<p class="nota">This series has no published videos yet.</p>
		{:else}
			<ol class="videos">
				{#each serie.videos as v, i (v.id)}
					<li class="tarjeta">
						<Fotograma videoId={v.id} segundo={60} clase="miniatura" />
						<div>
							<p class="orden">Part {i + 1}</p>
							<h3 lang="es"><a href={resolve('/videos/[id]', { id: v.id })}>{v.titulo}</a></h3>
							{#if v.duracionMs}<p class="duracion">{folio(v.duracionMs)}</p>{/if}
							{#if v.etiquetas.length}
								<ul class="etiquetas" aria-label="Topics">
									{#each v.etiquetas as e (e.id)}
										<li>
											<a class="chip" lang="es" href={resolve('/topics/[slug]', { slug: e.slug })}
												>{e.nombre}</a
											>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
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

	h2 {
		font-size: var(--t-2);
		margin-bottom: var(--e-3);
	}

	.miga,
	.nota,
	.ayuda,
	.procedencia,
	.duracion,
	.orden {
		color: var(--suave);
	}

	.nota {
		max-width: var(--medida);
	}

	.ayuda,
	.procedencia,
	.duracion,
	.orden {
		font-size: var(--t-0);
	}

	.preguntar {
		display: grid;
		padding: var(--e-4) var(--e-6);
		gap: var(--e-2);
		max-width: 44rem;
	}

	.preguntar label {
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

	.resumen p:first-of-type {
		max-width: var(--medida);
		font-family: var(--letra-texto);
	}

	.videos {
		display: grid;
		gap: var(--e-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.videos li {
		display: grid;
		padding: var(--e-3) var(--e-4);
		grid-template-columns: minmax(0, 12rem) 1fr;
		gap: var(--e-4);
		align-items: start;
	}

	h3 {
		font-size: var(--t-2);
	}

	.etiquetas {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
		margin: var(--e-2) 0 0;
		padding: 0;
		list-style: none;
	}

	@media (max-width: 36rem) {
		.videos li {
			grid-template-columns: 1fr;
		}
	}
</style>
