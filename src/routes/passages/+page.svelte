<script lang="ts">
	import { resolve } from '$app/paths';
	import { capituloYVersiculo, folio } from '#lib/formato.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ancla = (libro: string) => `libro-${libro.replace(/\s/g, '-')}`;
	const enlace = (videoId: string, momentoMs: number) =>
		resolve(`/videos/[id]?t=${Math.floor(momentoMs / 1000)}`, { id: videoId });
	const testamentos = $derived(
		(
			[
				['antiguo', 'Old Testament'],
				['nuevo', 'New Testament']
			] as const
		)
			.map(([clave, nombre]) => ({
				clave,
				nombre,
				libros: data.libros.filter((l) => l.testamento === clave)
			}))
			.filter((t) => t.libros.length)
	);
	const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
</script>

<svelte:head>
	<title>Scripture index — Glosa</title>
</svelte:head>

<div class="pagina">
	<header class="encabezado">
		<h1>Scripture index</h1>
		<p class="nota">
			Every Bible passage cited in the collection, spoken or shown on screen, in canonical order.
			Each reference is checked against the real chapters and verses of its book.
		</p>
	</header>

	{#if data.libros.length === 0}
		<p class="nota">No passages have been found in the transcribed videos yet.</p>
	{:else}
		<nav aria-label="Books" class="libros">
			{#each testamentos as t (t.clave)}
				<h2 id="t-{t.clave}">{t.nombre}</h2>
				<ul aria-labelledby="t-{t.clave}">
					{#each t.libros as l (l.libro)}
						<li>
							<a href="#{ancla(l.libro)}" lang="es"
								>{l.libro} <span class="cuantos">{l.pasajes.length}</span></a
							>
						</li>
					{/each}
				</ul>
			{/each}
		</nav>

		<div class="contenido">
			{#each data.libros as l (l.libro)}
				<section id={ancla(l.libro)} aria-labelledby="h-{ancla(l.libro)}">
					<h2 id="h-{ancla(l.libro)}" lang="es">{l.libro}</h2>
					<ul class="pasajes tarjeta">
						{#each l.pasajes as p (capituloYVersiculo(p))}
							<li class="pasaje">
								<h3 class="cita" lang="es">
									<span class="solo-lector">{l.libro} </span>{capituloYVersiculo(p)}
								</h3>
								<ul class="momentos" aria-label="Where it is cited">
									{#each p.momentos as m, i (i)}
										<li>
											<a class="folio" href={enlace(m.videoId, m.momentoMs)}
												>¶ {folio(m.momentoMs)}</a
											>
											<span class="titulo" lang="es">{m.titulo}</span>
											{#if m.origen === 'en_pantalla'}
												<span class="insignia"
													><svg viewBox="0 0 16 16" aria-hidden="true"
														><rect
															x="1.5"
															y="2.5"
															width="13"
															height="9"
															rx="1.5"
															fill="none"
															stroke="currentColor"
															stroke-width="1.4"
														/><path
															d="M5.5 14h5"
															stroke="currentColor"
															stroke-width="1.4"
															stroke-linecap="round"
														/></svg
													>shown on screen</span
												>
											{:else}
												<span class="insignia"
													><svg viewBox="0 0 16 16" aria-hidden="true"
														><path
															d="M8 1.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0V4A2.5 2.5 0 0 0 8 1.5zM3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5"
															fill="none"
															stroke="currentColor"
															stroke-width="1.4"
															stroke-linecap="round"
														/></svg
													>said</span
												>
											{/if}
										</li>
									{/each}
								</ul>
							</li>
						{/each}
					</ul>
					<p class="resumen-libro">
						{plural(l.pasajes.length, 'passage', 'passages')} from {l.libro}
					</p>
				</section>
			{/each}
		</div>
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
		margin: var(--e-2) 0 0;
	}

	/* ── Índice de libros ── */
	.libros {
		font-family: var(--letra-interfaz);
	}

	.libros h2 {
		margin: var(--e-4) 0 var(--e-2);
		color: var(--suave);
		font-size: var(--t-0);
		font-weight: 500;
	}

	.libros ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.libros a {
		display: inline-flex;
		align-items: center;
		gap: var(--e-2);
		min-height: 2.25rem;
		padding: 0 0.85rem;
		border: 1px solid var(--pauta);
		border-radius: 999px;
		background: var(--papel-alto);
		font-size: var(--t-0);
		font-weight: 500;
		text-decoration: none;
	}

	.libros a:hover {
		border-color: var(--suave);
	}

	.cuantos {
		color: var(--suave);
		font-weight: 400;
		font-variant-numeric: lining-nums;
	}

	/* ── Libros ── */
	section + section {
		margin-top: var(--e-12);
	}

	section > h2 {
		margin-bottom: var(--e-4);
		font-size: var(--t-4);
		font-style: italic;
	}

	.pasajes {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.pasaje + .pasaje {
		border-top: 1px solid var(--linea);
	}

	/* Como el índice de citas de una edición crítica: la referencia a la izquierda, los momentos a la derecha. */
	.pasaje {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr);
		gap: var(--e-4);
		align-items: baseline;
		padding: var(--e-4) var(--e-6);
	}

	.cita {
		font-size: var(--t-3);
		font-variant-numeric: lining-nums;
		line-height: 1;
	}

	.momentos {
		display: grid;
		gap: var(--e-2);
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--letra-interfaz);
	}

	.momentos li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--e-1) var(--e-3);
	}

	.momentos .folio {
		min-width: 4.5rem;
		font-size: var(--t-1);
		text-decoration: underline;
	}

	.titulo {
		font-family: var(--letra-texto);
	}

	.resumen-libro {
		margin: var(--e-2) 0 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	/* En pantallas anchas, el índice de libros queda fijo a la izquierda mientras se lee. */
	@media (min-width: 60rem) {
		.pagina {
			grid-template-columns: 15rem minmax(0, 1fr);
			column-gap: var(--e-12);
		}
		.encabezado {
			grid-column: 1 / -1;
		}
		.libros {
			align-self: start;
			position: sticky;
			top: calc(var(--alto-cabecera) + var(--e-6));
		}
		.libros h2:first-child {
			margin-top: 0;
		}
	}

	@media (max-width: 30rem) {
		.pasaje {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--e-2);
		}
	}
</style>
