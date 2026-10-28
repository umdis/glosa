<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { folio } from '#lib/formato.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let pensando = $state(false);

	const resultado = $derived(form && 'resultado' in form ? form.resultado : undefined);
	const enlace = (videoId: string, fragmentoId: number, inicioMs: number) =>
		resolve(`/videos/[id]?t=${Math.floor(inicioMs / 1000)}#f-${fragmentoId}`, { id: videoId });
</script>

<svelte:head>
	<title>{resultado ? `${resultado.pregunta} — Glosa` : 'Ask the collection — Glosa'}</title>
</svelte:head>

<div class="pagina">
	<h1>Ask the collection</h1>
	<p class="nota">
		Glosa reads the transcripts for you and answers with quotes. Every quote is checked against what
		was actually said before it is shown.
	</p>

	<form
		method="post"
		use:enhance={() => {
			pensando = true;
			return async ({ update }) => {
				await update({ reset: false });
				pensando = false;
			};
		}}
	>
		<label for="pregunta">Your question</label>
		<div class="fila">
			<input
				id="pregunta"
				name="pregunta"
				type="text"
				required
				minlength="3"
				maxlength="300"
				value={form?.pregunta ?? ''}
				aria-describedby={form?.error ? 'error-pregunta' : undefined}
			/>
			<button type="submit" disabled={pensando}>{pensando ? 'Reading…' : 'Ask'}</button>
		</div>
		{#if form?.error}<p id="error-pregunta" class="error">{form.error}</p>{/if}
	</form>

	<div class="estado" role="status" aria-live="polite">
		{#if pensando}
			<p class="leyendo">
				Searching the transcripts and checking every quote. This takes about half a minute.
			</p>
		{/if}
	</div>

	{#if resultado && !pensando}
		<section class="respuesta" aria-labelledby="titulo-respuesta">
			<h2 id="titulo-respuesta">{resultado.pregunta}</h2>

			{#if resultado.sinEvidencia}
				<p class="vacio">
					The videos do not talk about this, or not in words Glosa could find. Try asking with the
					words the speaker would use.
				</p>
			{:else}
				{#each resultado.afirmaciones as afirmacion, i (i)}
					<div class="afirmacion" class:sin-respaldo={afirmacion.respaldo === 'sin_respaldo'}>
						<p class="texto-afirmacion">
							{#if afirmacion.respaldo === 'sin_respaldo'}<span class="etiqueta"
									>No supporting quote:</span
								>
							{/if}{afirmacion.texto}
						</p>
						<ul class="glosas">
							{#each afirmacion.citas as cita, j (j)}
								<li class:no-hallada={cita.estado !== 'verificada'}>
									<blockquote lang="es">«{cita.frase}»</blockquote>
									{#if cita.estado === 'verificada'}
										<p class="fuente">
											<svg class="sello" viewBox="0 0 16 16" aria-hidden="true"
												><circle cx="8" cy="8" r="6.5" /><path d="M5 8.2l2 2 4-4.4" /></svg
											>
											Verified in
											<a class="folio" href={enlace(cita.videoId, cita.fragmentoId, cita.inicioMs)}
												>{cita.titulo}, ¶ {folio(cita.inicioMs)}</a
											>
										</p>
									{:else}
										<p class="fuente">
											Not found in the transcript, so it is not used as evidence.
										</p>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			{/if}

			{#if resultado.busquedas.length}
				<p class="busquedas">
					Searched the transcripts for {resultado.busquedas.map((b) => `“${b}”`).join(', ')}.
				</p>
			{/if}
		</section>
	{/if}
</div>

<style>
	.pagina {
		max-width: calc(var(--medida) + 8rem);
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
		margin: 0.5rem 0 2rem;
	}

	label {
		display: block;
		font-family: var(--letra-interfaz);
		margin-bottom: 0.4rem;
	}

	.fila {
		display: flex;
		gap: 0.5rem;
	}

	input[type='text'] {
		flex: 1;
		min-width: 0;
		font-family: var(--letra-texto);
		font-size: var(--t-2);
		background: var(--papel);
		color: var(--tinta);
		border: 1px solid var(--suave);
		border-radius: 3px;
		padding: 0.35rem 0.7rem;
	}

	button[disabled] {
		opacity: 0.75;
		cursor: progress;
	}

	.error {
		font-family: var(--letra-interfaz);
		margin: 0.5rem 0 0;
	}

	.error::before {
		content: '⚠ ';
	}

	.leyendo {
		color: var(--suave);
		font-style: italic;
		margin-top: 2rem;
	}

	.respuesta {
		margin-top: 3rem;
	}

	h2 {
		font-size: var(--t-3);
		margin-bottom: 1.75rem;
		max-width: var(--medida);
	}

	.afirmacion {
		margin-bottom: 2rem;
		max-width: var(--medida);
	}

	.texto-afirmacion {
		font-size: var(--t-2);
		line-height: 1.45;
		margin: 0 0 0.75rem;
	}

	.sin-respaldo .texto-afirmacion {
		color: var(--suave);
	}

	.etiqueta {
		font-family: var(--letra-interfaz);
		font-size: var(--t-1);
		margin-right: 0.35rem;
	}

	/* Cada cita es una glosa: sangrada, con un filete fino que la ata a su afirmación. */
	.glosas {
		list-style: none;
		margin: 0;
		padding: 0 0 0 1.25rem;
		border-left: 1px solid var(--pauta);
	}

	.glosas li + li {
		margin-top: 0.9rem;
	}

	blockquote {
		margin: 0;
		font-style: italic;
	}

	.fuente {
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
		color: var(--suave);
		margin: 0.2rem 0 0;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.fuente .folio {
		font-size: var(--t-1);
	}

	.sello {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: var(--rubrica);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.no-hallada blockquote {
		color: var(--suave);
		text-decoration: line-through;
		text-decoration-thickness: 1px;
	}

	.busquedas,
	.vacio {
		color: var(--suave);
		max-width: var(--medida);
	}

	.busquedas {
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
		margin-top: 2.5rem;
	}

	@media (prefers-reduced-motion: no-preference) {
		.sello {
			animation: sellar 0.45s ease-out both;
		}
		@keyframes sellar {
			from {
				transform: scale(1.6);
				opacity: 0;
			}
		}
	}
</style>
