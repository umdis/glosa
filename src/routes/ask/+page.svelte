<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Estudio from '#lib/componentes/Estudio.svelte';
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import { folio } from '#lib/formato.js';
	import { consultaGuardar } from '#lib/investigaciones.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pensando = $state(false);
	let campo = $state<HTMLInputElement>();

	const resultado = $derived(form && 'resultado' in form ? form.resultado : undefined);
	const enlace = (videoId: string, fragmentoId: number, inicioMs: number) =>
		resolve(`/videos/[id]?t=${Math.floor(inicioMs / 1000)}#f-${fragmentoId}`, { id: videoId });

	/** Un ejemplo solo rellena el campo: cada pregunta cuesta, así que la envía la persona. */
	function usarEjemplo(texto: string) {
		if (!campo) return;
		campo.value = texto;
		campo.focus();
	}
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
		class="compositor tarjeta"
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
				bind:this={campo}
				value={form?.pregunta ?? ''}
				aria-describedby={form?.error ? 'error-pregunta' : undefined}
			/>
			<button type="submit" disabled={pensando}>{pensando ? 'Reading…' : 'Ask'}</button>
		</div>
		{#if form?.error}<p id="error-pregunta" class="error">{form.error}</p>{/if}
		{#if data.ejemplos.length && !resultado}
			<div class="ejemplos">
				<span id="t-ejemplos">Try asking</span>
				<ul aria-labelledby="t-ejemplos">
					{#each data.ejemplos as ejemplo (ejemplo)}
						<li>
							<button type="button" class="chip" onclick={() => usarEjemplo(ejemplo)}
								>{ejemplo}</button
							>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</form>

	<div class="estado" role="status" aria-live="polite">
		{#if pensando}
			<p class="leyendo">
				Searching the transcripts and checking every quote. This takes about half a minute.
			</p>
		{/if}
	</div>

	{#if pensando}
		<!-- La forma de la respuesta mientras llega: sin pasos inventados, solo el hueco que ocupará. -->
		<div class="esperando" aria-hidden="true">
			{#each [0, 1] as i (i)}
				<div class="afirmacion">
					<div class="texto-afirmacion">
						<span class="esqueleto" style:width="92%"></span>
						<span class="esqueleto" style:width="76%"></span>
					</div>
					<div class="citas">
						<div class="glosa hueco">
							<span class="esqueleto" style:width="100%"></span>
							<span class="esqueleto" style:width="60%"></span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if resultado}
		<section class="respuesta" aria-labelledby="titulo-respuesta">
			<h2 id="titulo-respuesta">{resultado.pregunta}</h2>
			{#if form && 'desdeGuardada' in form && form.desdeGuardada}
				<p class="guardada">
					The AI service is not available right now, so this is the answer Glosa saved the last time
					someone asked this question. Its quotes were verified then.
				</p>
			{/if}

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
						<ul class="citas" style:--retardo="{200 + i * 120}ms">
							{#each afirmacion.citas as cita, j (j)}
								<li
									class="glosa"
									class:no-hallada={cita.estado !== 'verificada'}
									class:con-cuadro={cita.estado === 'verificada'}
								>
									{#if cita.estado === 'verificada'}
										<Fotograma
											videoId={cita.videoId}
											segundo={cita.inicioMs / 1000}
											clase="miniatura"
										/>
									{/if}
									<blockquote lang="es">«{cita.frase}»</blockquote>
									{#if cita.estado === 'verificada'}
										<p class="fuente">
											<svg class="sello" viewBox="0 0 16 16" aria-hidden="true"
												><circle cx="8" cy="8" r="6.5" /><path d="M5 8.2l2 2 4-4.4" /></svg
											>
											Verified in
											<a class="folio" href={enlace(cita.videoId, cita.fragmentoId, cita.inicioMs)}
												><span lang="es">{cita.titulo}</span>, ¶ {folio(cita.inicioMs)}</a
											>
										</p>
										<p class="acciones-cita">
											<a
												class="guardar"
												href="{resolve('/investigations/save')}{consultaGuardar(
													cita.fragmentoId,
													cita.frase
												)}"
												data-guardar-cita
												data-etiqueta="{cita.titulo}, {folio(cita.inicioMs)}"
												>Save to investigation<span class="solo-lector">: «{cita.frase}»</span></a
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

			{#if resultado.afirmaciones.some((a) => a.respaldo === 'respaldada')}
				<Estudio respuesta={resultado} origen={page.url.origin} />
			{/if}
		</section>
	{/if}
</div>

<style>
	.pagina {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) 5rem;
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
	}

	.nota {
		color: var(--suave);
		max-width: var(--medida);
		margin: var(--e-2) 0 var(--e-6);
	}

	/* ── Compositor ── */
	.compositor {
		max-width: 46rem;
		padding: var(--e-6);
		font-family: var(--letra-interfaz);
	}

	label {
		display: block;
		margin-bottom: var(--e-2);
	}

	.fila {
		display: flex;
		gap: var(--e-2);
	}

	input[type='text'] {
		flex: 1;
		min-width: 0;
		min-height: 3.25rem;
		font-family: var(--letra-texto);
		font-size: var(--t-2);
	}

	.fila button {
		min-height: 3.25rem;
		min-width: 6.5rem;
	}

	.error {
		margin: var(--e-2) 0 0;
	}

	.error::before {
		content: '⚠ ';
	}

	.ejemplos {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2) var(--e-3);
		margin-top: var(--e-4);
		color: var(--suave);
	}

	.ejemplos ul {
		display: contents;
		list-style: none;
	}

	.leyendo {
		color: var(--suave);
		font-style: italic;
		margin: var(--e-8) 0 0;
	}

	/* ── Respuesta: cada afirmación con sus citas como glosas ── */
	.respuesta,
	.esperando {
		margin-top: var(--e-12);
	}

	h2 {
		font-size: var(--t-3);
		font-style: italic;
		margin-bottom: var(--e-8);
		max-width: var(--medida);
	}

	.afirmacion {
		display: grid;
		gap: var(--e-4);
		margin-bottom: var(--e-12);
	}

	.texto-afirmacion {
		max-width: var(--medida);
		margin: 0;
		font-size: var(--t-2);
		line-height: 1.45;
	}

	.esperando .texto-afirmacion {
		display: grid;
		gap: var(--e-3);
		padding-top: 0.35rem;
	}

	.sin-respaldo .texto-afirmacion {
		color: var(--suave);
	}

	.etiqueta {
		font-family: var(--letra-interfaz);
		font-size: var(--t-1);
		margin-right: 0.35rem;
	}

	/* En columna, las citas cuelgan de su afirmación con un filete. */
	.citas {
		display: grid;
		gap: var(--e-3);
		margin: 0;
		padding: 0 0 0 var(--e-4);
		border-left: 2px solid var(--pauta);
		list-style: none;
	}

	.sin-respaldo .citas {
		border-left-style: dashed;
	}

	/*
	 * El cuadro del momento va en miniatura junto a la cita: en una prédica casi todos los cuadros
	 * se parecen, y a todo el ancho ahogarían las palabras, que son la evidencia.
	 */
	.con-cuadro {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr);
		column-gap: var(--e-3);
	}

	.con-cuadro :global(.miniatura) {
		grid-row: 1 / span 2;
		align-self: start;
		margin-top: 0.2rem;
		border-radius: var(--radio-s);
	}

	.hueco {
		display: grid;
		gap: var(--e-3);
		padding-block: var(--e-4);
	}

	blockquote {
		margin: 0;
		font-family: var(--letra-texto);
		font-size: var(--t-1);
		font-style: italic;
		line-height: 1.5;
	}

	.fuente {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		margin: var(--e-2) 0 0;
		color: var(--suave);
		font-size: var(--t-0);
	}

	.fuente .folio {
		font-size: var(--t-1);
		white-space: normal;
	}

	.acciones-cita {
		grid-column: 2;
		margin: var(--e-1) 0 0;
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	/* Objetivo táctil de 24 px como mínimo (WCAG 2.5.8), aunque se lea como enlace. */
	.guardar {
		display: inline-flex;
		align-items: center;
		min-height: 1.75rem;
		color: var(--suave);
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

	.no-hallada {
		background: transparent;
		box-shadow: none;
		border-style: dashed;
	}

	.no-hallada blockquote {
		color: var(--suave);
		text-decoration: line-through;
		text-decoration-thickness: 1px;
	}

	.busquedas,
	.vacio,
	.guardada {
		color: var(--suave);
		max-width: var(--medida);
	}

	.guardada {
		font-family: var(--letra-interfaz);
		border-left: 2px solid var(--suave);
		padding-left: var(--e-3);
		margin: calc(var(--e-4) * -1) 0 var(--e-6);
	}

	.busquedas {
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
		margin-top: var(--e-4);
	}

	/* En pantallas anchas, las citas salen al margen y un hilo las ata a su afirmación. */
	@media (min-width: 60rem) {
		.afirmacion {
			grid-template-columns: minmax(0, 1fr) 21rem;
			column-gap: var(--e-12);
			align-items: start;
		}
		.citas {
			padding-left: 0;
			border-left: 0;
			--hilo: calc(var(--e-12) - var(--e-2));
			--hilo-punto: 1;
		}
		.citas .glosa + .glosa {
			--hilo: 0;
			--hilo-punto: 0;
		}
		.sin-respaldo .citas .glosa::before {
			border-top-style: dashed;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.sello {
			animation: sellar 0.45s ease-out both;
			animation-delay: var(--retardo, 0ms);
		}
		@keyframes sellar {
			from {
				transform: scale(1.6);
				opacity: 0;
			}
		}
	}
</style>
