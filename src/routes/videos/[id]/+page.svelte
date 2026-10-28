<script lang="ts">
	import { duracion, folio } from '#lib/formato.js';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let reproductor = $state<HTMLVideoElement>();
	// Parte del minuto pedido en ?t= (también al pasar a otro video); el reproductor lo actualiza.
	let tiempoMs = $derived(data.inicioSegundos * 1000);
	let seguir = $state(true);
	/** Mientras la persona se mueve por la transcripción, no se la arrastra con el video. */
	let pausaSeguimientoHasta = 0;

	/**
	 * Índice del fragmento que suena: el último cuyo inicio ya pasó (búsqueda binaria). Se compara
	 * por segundos enteros porque los enlaces (?t=) redondean hacia abajo: con ?t=383, el fragmento
	 * que empieza en 383,5 s ya cuenta como el actual.
	 */
	const actual = $derived.by(() => {
		const f = data.fragmentos;
		const segundo = Math.floor(tiempoMs / 1000);
		let bajo = 0;
		let alto = f.length - 1;
		let encontrado = -1;
		while (bajo <= alto) {
			const medio = (bajo + alto) >> 1;
			if (Math.floor(f[medio].inicioMs / 1000) <= segundo) {
				encontrado = medio;
				bajo = medio + 1;
			} else alto = medio - 1;
		}
		return encontrado;
	});

	const pagina = $derived(resolve('/videos/[id]', { id: data.video.id }));
	const fuente = $derived(
		`${resolve('/videos/[id]/media', { id: data.video.id })}${data.inicioSegundos ? `#t=${data.inicioSegundos}` : ''}`
	);

	function saltarA(evento: MouseEvent, ms: number) {
		if (!reproductor || evento.metaKey || evento.ctrlKey || evento.shiftKey) return;
		evento.preventDefault();
		reproductor.currentTime = ms / 1000;
		tiempoMs = ms;
		void reproductor.play().catch(() => {});
		replaceState(resolve(`/videos/[id]?t=${Math.floor(ms / 1000)}`, { id: data.video.id }), {});
	}

	function pausarSeguimiento() {
		pausaSeguimientoHasta = Date.now() + 6000;
	}

	$effect(() => {
		if (!seguir || actual < 0 || Date.now() < pausaSeguimientoHasta) return;
		const elemento = document.getElementById(`f-${data.fragmentos[actual].id}`);
		const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
		elemento?.scrollIntoView({ block: 'center', behavior: sinMovimiento ? 'auto' : 'smooth' });
	});
</script>

<svelte:head>
	<title>{data.video.titulo} — Glosa</title>
</svelte:head>

<article class="manuscrito">
	<header class="encabezado">
		<h1>{data.video.titulo}</h1>
		{#if data.video.duracionMs}<p class="dato">{duracion(data.video.duracionMs)}</p>{/if}
	</header>

	<!-- La miniatura iluminada del manuscrito: el video, con subtítulos de la propia transcripción. -->
	<figure class="iluminacion">
		<video
			bind:this={reproductor}
			ontimeupdate={(e) => (tiempoMs = e.currentTarget.currentTime * 1000)}
			controls
			preload="metadata"
			src={fuente}
		>
			<track
				kind="captions"
				srclang="es"
				label="Español"
				src={resolve('/videos/[id]/captions.vtt', { id: data.video.id })}
			/>
		</video>
	</figure>

	<div class="opciones">
		<label>
			<input type="checkbox" bind:checked={seguir} />
			Follow the transcript while the video plays
		</label>
	</div>

	<h2 class="solo-lector">Transcript</h2>
	{#if data.fragmentos.length === 0}
		<p class="dato">The transcript of this video is not available yet.</p>
	{:else}
		<ol
			class="texto"
			lang="es"
			onwheel={pausarSeguimiento}
			ontouchmove={pausarSeguimiento}
			onfocusin={pausarSeguimiento}
		>
			{#each data.fragmentos as f, i (f.id)}
				<li id="f-{f.id}" aria-current={i === actual ? 'true' : undefined}>
					<a
						class="folio"
						href="{pagina}?t={Math.floor(f.inicioMs / 1000)}"
						onclick={(e) => saltarA(e, f.inicioMs)}
						aria-label="Play from {folio(f.inicioMs)}"
						lang="en"
					>
						<span class="calderon" aria-hidden="true">¶</span>{folio(f.inicioMs)}
					</a>
					<p>
						{f.texto}{#if i === actual}<span class="solo-lector" lang="en">
								(now playing)</span
							>{/if}
					</p>
				</li>
			{/each}
		</ol>
	{/if}
</article>

<style>
	/*
	 * La página como un folio: margen interior para la numeración (los minutos), columna de
	 * texto a medida de lectura y margen exterior, que alojará las glosas del agente.
	 */
	.manuscrito {
		display: grid;
		grid-template-columns: [margen] 5.5rem [texto] minmax(0, var(--medida)) [exterior] minmax(
				0,
				1fr
			);
		column-gap: 1.5rem;
		max-width: 72rem;
		margin: 0 auto;
		padding: 2.5rem var(--margen) 5rem;
	}

	.encabezado,
	.iluminacion,
	.opciones,
	.texto {
		grid-column: texto / -1;
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
		max-width: var(--medida);
	}

	.dato {
		color: var(--suave);
		font-family: var(--letra-interfaz);
		margin: 0.35rem 0 0;
	}

	.iluminacion {
		margin: 2rem 0 1rem;
		max-width: 48rem;
	}

	/*
	 * En pantallas anchas el video pasa al margen exterior y queda fijo mientras se lee: así un
	 * enlace a un minuto muestra a la vez la frase y la imagen. Ahí mismo irán las glosas.
	 */
	@media (min-width: 74rem) {
		.manuscrito {
			max-width: 86rem;
		}
		.encabezado {
			grid-column: texto;
			grid-row: 1;
		}
		.opciones {
			grid-column: texto;
			grid-row: 2;
		}
		.texto {
			grid-column: texto;
			grid-row: 3;
		}
		.iluminacion {
			grid-column: exterior;
			grid-row: 1 / 4;
			align-self: start;
			position: sticky;
			top: 1.5rem;
			margin: 0.5rem 0 0 1.5rem;
		}
	}

	video {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: 2px;
	}

	.opciones {
		font-family: var(--letra-interfaz);
		margin-bottom: 2.5rem;
	}

	.opciones label {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		min-height: 2.75rem;
		cursor: pointer;
	}

	.opciones input {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--tinta);
	}

	.texto {
		list-style: none;
		margin: 0;
		padding: 0;
		/* El texto se alinea con la columna; los folios sobresalen hacia el margen interior. */
		margin-left: calc(-5.5rem - 1.5rem);
	}

	.texto li {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, var(--medida));
		column-gap: 1.5rem;
		align-items: baseline;
		scroll-margin-block: 30vh;
	}

	.texto p {
		margin: 0 0 0.9rem;
		font-size: var(--t-1);
		line-height: 1.7;
		hyphens: auto;
	}

	.folio {
		justify-self: end;
		text-decoration: none;
		font-size: var(--t-0);
		padding: 0.15rem 0;
	}

	.folio:hover {
		text-decoration: underline;
	}

	/* El calderón solo aparece junto a lo que suena: el lector ve dónde va el video. */
	.calderon {
		display: inline-block;
		width: 0.9em;
		visibility: hidden;
	}

	[aria-current='true'] .calderon {
		visibility: visible;
	}

	[aria-current='true'] p {
		background: var(--papel);
		box-shadow:
			-0.6rem 0 0 var(--papel),
			0.6rem 0 0 var(--papel);
	}

	@media (max-width: 48rem) {
		.manuscrito {
			grid-template-columns: [margen texto] minmax(0, 1fr) [exterior];
		}
		.texto {
			margin-left: 0;
		}
		.texto li {
			grid-template-columns: minmax(0, 1fr);
		}
		.folio {
			justify-self: start;
		}
	}
</style>
