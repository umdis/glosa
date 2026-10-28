<script lang="ts">
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import { concordancia, folio } from '#lib/formato.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Video elegido en el filtro; `null` es «todos». Se reinicia con cada búsqueda nueva. */
	let filtro = $derived.by<string | null>(() => {
		void data.consulta;
		return null;
	});

	const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
	const grupos = $derived(filtro ? data.grupos.filter((g) => g.videoId === filtro) : data.grupos);
	const enPantalla = $derived(
		filtro ? data.enPantalla.filter((p) => p.videoId === filtro) : data.enPantalla
	);
	const videosConResultados = $derived(
		[
			...new Map(
				[...data.grupos, ...data.enPantalla].map((g) => [g.videoId, g.titulo] as const)
			).entries()
		].map(([videoId, titulo]) => ({ videoId, titulo }))
	);
	const enlace = (videoId: string, ms: number, fragmentoId?: number) =>
		resolve(`/videos/[id]?t=${Math.floor(ms / 1000)}${fragmentoId ? `#f-${fragmentoId}` : ''}`, {
			id: videoId
		});
</script>

<svelte:head>
	<title>{data.consulta ? `“${data.consulta}” — Glosa` : 'Search — Glosa'}</title>
</svelte:head>

<div class="pagina">
	{#if !data.consulta}
		<h1>Search what was said</h1>
		<p class="nota">
			Type a word or a phrase in the search box to find every moment it was said. Press <kbd>/</kbd> to
			jump to the search box from anywhere.
		</p>
	{:else if data.total === 0 && data.enPantalla.length === 0}
		<h1>Nothing found for “{data.consulta}”</h1>
		<p class="nota">
			No transcript contains those words. Try a single word, another form of it, or a shorter
			phrase.
		</p>
	{:else}
		<header class="encabezado">
			<h1>“{data.consulta}”</h1>
			<p class="nota" role="status">
				{plural(data.total, 'moment', 'moments')} in {plural(
					data.grupos.length,
					'video',
					'videos'
				)}{#if data.enPantalla.length}, and {plural(data.enPantalla.length, 'note', 'notes')} shown on
					screen{/if}
			</p>
			{#if videosConResultados.length > 1}
				<div class="filtro" role="group" aria-label="Show results from">
					<button
						type="button"
						class="chip"
						aria-pressed={filtro === null}
						onclick={() => (filtro = null)}>All videos</button
					>
					{#each videosConResultados as v (v.videoId)}
						<button
							type="button"
							class="chip"
							lang="es"
							aria-pressed={filtro === v.videoId}
							onclick={() => (filtro = v.videoId)}>{v.titulo}</button
						>
					{/each}
				</div>
			{/if}
		</header>

		{#each grupos as grupo (grupo.videoId)}
			<section class="grupo tarjeta" aria-labelledby="g-{grupo.videoId}">
				<header class="cabeza">
					<Fotograma
						videoId={grupo.videoId}
						segundo={grupo.momentos[0].inicioMs / 1000}
						clase="miniatura"
					/>
					<div>
						<h2 id="g-{grupo.videoId}" lang="es">
							<a href={resolve('/videos/[id]', { id: grupo.videoId })}>{grupo.titulo}</a>
						</h2>
						<p class="cuenta">{plural(grupo.momentos.length, 'moment', 'moments')}</p>
					</div>
				</header>
				<ol class="concordancia" lang="es">
					{#each grupo.momentos as m (m.fragmentoId)}
						{@const c = concordancia(m.texto, m.marcas)}
						<li>
							<a
								class="folio"
								href={enlace(m.videoId, m.inicioMs, m.fragmentoId)}
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

		{#if enPantalla.length}
			<section class="pantallas" aria-labelledby="t-pantalla">
				<h2 id="t-pantalla">Shown on screen</h2>
				<ul>
					{#each enPantalla as p (`${p.videoId}-${p.momentoMs}`)}
						<li class="glosa">
							<Fotograma videoId={p.videoId} segundo={p.momentoMs / 1000} clase="cuadro" />
							<p class="rotulo">
								<span lang="es">{p.titulo}</span>,
								<a
									class="folio"
									href={enlace(p.videoId, p.momentoMs)}
									aria-label="Play {p.titulo} from {folio(p.momentoMs)}">¶ {folio(p.momentoMs)}</a
								>
							</p>
							<p class="escrito" lang="es">{p.texto}</p>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.pagina {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) var(--e-16);
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
	}

	.nota {
		color: var(--suave);
		font-family: var(--letra-interfaz);
		margin: var(--e-2) 0 0;
		max-width: var(--medida);
	}

	.encabezado {
		margin-bottom: var(--e-8);
	}

	.filtro {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
		margin-top: var(--e-4);
	}

	/* ── Un grupo por video ── */
	.grupo {
		overflow: hidden;
	}

	.grupo + .grupo {
		margin-top: var(--e-6);
	}

	.cabeza {
		display: flex;
		align-items: center;
		gap: var(--e-4);
		padding: var(--e-4) var(--e-6);
		border-bottom: 1px solid var(--linea);
		background: var(--papel);
	}

	.cabeza :global(.miniatura) {
		flex: none;
		width: 7rem;
		border-radius: var(--radio-s);
	}

	h2 {
		font-size: var(--t-2);
		line-height: 1.2;
	}

	h2 a {
		text-decoration: none;
	}

	h2 a:hover {
		text-decoration: underline;
	}

	.cuenta {
		margin: var(--e-1) 0 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	/*
	 * Concordancia: como en las concordancias bíblicas, todas las palabras buscadas empiezan en la
	 * misma vertical y el contexto se lee a ambos lados. El folio, en el margen, lleva al momento.
	 * Los bordes recortados se desvanecen: el corte es intencional, no un desborde.
	 */
	.concordancia {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr) minmax(0, 1.15fr);
		margin: 0;
		padding: var(--e-2) var(--e-4);
		list-style: none;
	}

	.concordancia li {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		column-gap: 0.3rem;
		align-items: baseline;
		padding: 0.45rem var(--e-2);
		border-radius: var(--radio-s);
	}

	.concordancia li:hover {
		background: var(--papel);
	}

	.concordancia .folio {
		text-decoration: none;
		padding: 0.1rem 0;
	}

	.concordancia .folio:hover {
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

	/* ── Lo que salió en pantalla: aquí el cuadro sí importa, es la diapositiva ── */
	.pantallas {
		margin-top: var(--e-12);
	}

	.pantallas h2 {
		margin-bottom: var(--e-4);
		font-style: italic;
	}

	.pantallas ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
		gap: var(--e-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.glosa :global(.cuadro) {
		margin: calc(var(--e-3) * -1) calc(var(--e-4) * -1) var(--e-3);
		border-radius: var(--radio-m) var(--radio-m) 0 0;
	}

	.rotulo {
		color: var(--suave);
		font-size: var(--t-0);
	}

	.rotulo .folio {
		font-size: var(--t-1);
		text-decoration: underline;
	}

	.escrito {
		margin-top: var(--e-2);
		font-family: var(--letra-texto);
		white-space: pre-line;
	}

	/* En pantallas angostas la columna central no cabe: cada momento se lee como una línea corrida. */
	@media (max-width: 44rem) {
		.concordancia {
			display: block;
		}
		.concordancia li {
			display: block;
			margin-bottom: var(--e-2);
		}
		.concordancia .folio {
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
