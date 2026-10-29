<script lang="ts">
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import { contiene, duracion, folio, resaltar } from '#lib/formato.js';
	import { consultaGuardar } from '#lib/investigaciones.js';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** El mismo cuadro que el póster de la colección: la transición une las dos piezas. */
	const poster = $derived(
		`${resolve('/videos/[id]/fotograma/[segundo]', { id: data.video.id, segundo: String(data.posterSegundo) })}?w=640`
	);

	let reproductor = $state<HTMLVideoElement>();
	// Parte del minuto pedido en ?t= (también al pasar a otro video); el reproductor lo actualiza.
	let tiempoMs = $derived(data.inicioSegundos * 1000);
	let seguir = $state(true);
	/** Mientras la persona se mueve por la transcripción, no se la arrastra con el video. */
	let pausaSeguimientoHasta = 0;
	/** Lo que suena quedó fuera de la vista: se ofrece volver. */
	let lejos = $state(false);
	let haSonado = $state(false);
	// Buscar dentro del video: la consulta y cuál de las coincidencias se está viendo.
	let busqueda = $state('');
	let posicion = $state(0);

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
	const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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

	function elementoActual() {
		return actual < 0 ? null : document.getElementById(`f-${data.fragmentos[actual].id}`);
	}

	/** Si lo que suena está fuera de la vista (por arriba, bajo la cabecera, o por abajo). */
	function revisarVista() {
		const elemento = elementoActual();
		if (!elemento) return (lejos = false);
		const caja = elemento.getBoundingClientRect();
		const cabecera = document.querySelector('.cabecera')?.getBoundingClientRect().bottom ?? 0;
		lejos = caja.bottom < cabecera || caja.top > innerHeight;
	}

	function volverALoQueSuena() {
		pausaSeguimientoHasta = 0;
		const elemento = elementoActual();
		if (!elemento) return;
		elemento.scrollIntoView({ block: 'center', behavior: sinMovimiento() ? 'auto' : 'smooth' });
		elemento.querySelector<HTMLElement>('.folio')?.focus({ preventScroll: true });
	}

	$effect(() => {
		const elemento = elementoActual();
		if (!seguir || busqueda || !elemento || Date.now() < pausaSeguimientoHasta) {
			revisarVista();
			return;
		}
		elemento.scrollIntoView({ block: 'center', behavior: sinMovimiento() ? 'auto' : 'smooth' });
		lejos = false;
	});

	const coincidencias = $derived(
		busqueda.trim().length < 2
			? []
			: data.fragmentos.flatMap((f, i) => (contiene(f.texto, busqueda) ? [i] : []))
	);
	const estadoBusqueda = $derived(
		busqueda.trim().length < 2
			? ''
			: coincidencias.length === 0
				? 'No matches in this video'
				: `${posicion + 1} of ${coincidencias.length}`
	);

	function irACoincidencia(paso: number) {
		if (coincidencias.length === 0) return;
		posicion = (posicion + paso + coincidencias.length) % coincidencias.length;
		const fragmento = data.fragmentos[coincidencias[posicion]];
		document
			.getElementById(`f-${fragmento.id}`)
			?.scrollIntoView({ block: 'center', behavior: sinMovimiento() ? 'auto' : 'smooth' });
	}

	function alEscribir() {
		posicion = 0;
		if (coincidencias.length) irACoincidencia(0);
	}

	function teclasBusqueda(evento: KeyboardEvent) {
		if (evento.key === 'Enter') {
			evento.preventDefault();
			irACoincidencia(evento.shiftKey ? -1 : 1);
		} else if (evento.key === 'Escape') {
			busqueda = '';
		}
	}

	const coincidenciaActual = $derived(
		coincidencias.length ? data.fragmentos[coincidencias[posicion]]?.id : undefined
	);

	/**
	 * Lo que «Save this passage» guarda: la coincidencia que se está viendo o, si no se busca nada,
	 * lo que suena. Un solo botón en las herramientas, en vez de uno por fragmento en la transcripción.
	 */
	const pasajeParaGuardar = $derived(
		(coincidencias.length
			? data.fragmentos[coincidencias[posicion]]
			: data.fragmentos[Math.max(actual, 0)]) ?? undefined
	);
</script>

<svelte:head>
	<title>{data.video.titulo} — Glosa</title>
</svelte:head>

<svelte:window onscroll={revisarVista} onresize={revisarVista} />

<article class="manuscrito">
	<header class="encabezado">
		<h1 lang="es">{data.video.titulo}</h1>
		{#if data.video.duracionMs}<p class="dato">{duracion(data.video.duracionMs)}</p>{/if}
		{#if data.ficha.resumen}<p class="resumen" lang="es">{data.ficha.resumen}</p>{/if}
	</header>

	<!-- La lámina: el video con subtítulos de la propia transcripción, las herramientas y el índice. -->
	<div class="lamina">
		<figure class="iluminacion" style:view-transition-name="video-{data.video.id}">
			<video
				bind:this={reproductor}
				ontimeupdate={(e) => (tiempoMs = e.currentTarget.currentTime * 1000)}
				onplay={() => (haSonado = true)}
				controls
				preload="metadata"
				poster={page.data.fotogramas !== false ? poster : undefined}
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

		<div class="herramientas">
			<label class="interruptor">
				<input type="checkbox" role="switch" bind:checked={seguir} />
				Follow the transcript
			</label>
			<form class="buscar-video" role="search" onsubmit={(e) => e.preventDefault()}>
				<label for="buscar-video">Find in this video</label>
				<div class="fila">
					<div class="campo-buscar">
						<svg viewBox="0 0 20 20" aria-hidden="true"
							><circle
								cx="8.5"
								cy="8.5"
								r="5.5"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
							/><path
								d="M13 13l4.5 4.5"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
							/></svg
						>
						<input
							id="buscar-video"
							type="search"
							autocomplete="off"
							lang="es"
							bind:value={busqueda}
							oninput={alEscribir}
							onkeydown={teclasBusqueda}
							aria-describedby="estado-busqueda"
						/>
					</div>
					<button
						type="button"
						class="secundario"
						aria-label="Previous match"
						disabled={coincidencias.length === 0}
						onclick={() => irACoincidencia(-1)}
						><svg viewBox="0 0 20 20" aria-hidden="true"
							><path
								d="M12.5 4.5L7 10l5.5 5.5"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							/></svg
						></button
					>
					<button
						type="button"
						class="secundario"
						aria-label="Next match"
						disabled={coincidencias.length === 0}
						onclick={() => irACoincidencia(1)}
						><svg viewBox="0 0 20 20" aria-hidden="true"
							><path
								d="M7.5 4.5L13 10l-5.5 5.5"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							/></svg
						></button
					>
				</div>
				<p id="estado-busqueda" class="estado" role="status">{estadoBusqueda}</p>
			</form>
			{#if pasajeParaGuardar}
				<a
					class="boton secundario guardar-pasaje"
					href="{resolve('/investigations/save')}{consultaGuardar(pasajeParaGuardar.id)}"
					data-guardar-cita
					data-texto={pasajeParaGuardar.texto}
					data-etiqueta="{data.video.titulo}, {folio(pasajeParaGuardar.inicioMs)}"
					>Save the passage at ¶ {folio(pasajeParaGuardar.inicioMs)}</a
				>
			{/if}
		</div>

		{#if data.ficha.temas.length || data.pasajes.length}
			<section class="indice" aria-labelledby="t-indice">
				<h2 id="t-indice">In this video</h2>
				{#if data.ficha.temas.length}
					<ul class="temas" aria-label="Topics" lang="es">
						{#each data.ficha.temas as tema (tema)}
							<li>
								<a class="chip" href={resolve(`/search?q=${encodeURIComponent(tema)}`)}>{tema}</a>
							</li>
						{/each}
					</ul>
				{/if}
				{#if data.pasajes.length}
					<ul class="pasajes" aria-label="Scripture cited">
						{#each data.pasajes as p, i (i)}
							<li>
								<a
									class="folio"
									href="{pagina}?t={Math.floor(p.momentoMs / 1000)}"
									onclick={(e) => saltarA(e, p.momentoMs)}>¶ {folio(p.momentoMs)}</a
								>
								<span lang="es">{p.referencia}</span>
								{#if p.origen === 'en_pantalla'}<span class="insignia">on screen</span>{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</div>

	<h2 class="solo-lector">Transcript</h2>
	{#if data.fragmentos.length === 0}
		<p class="dato texto">The transcript of this video is not available yet.</p>
	{:else}
		<ol
			class="texto"
			lang="es"
			onwheel={pausarSeguimiento}
			ontouchmove={pausarSeguimiento}
			onfocusin={pausarSeguimiento}
		>
			{#each data.fragmentos as f, i (f.id)}
				<li
					id="f-{f.id}"
					aria-current={i === actual ? 'true' : undefined}
					class:pasado={i < actual}
					class:hallado={f.id === coincidenciaActual}
				>
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
						{#if busqueda.trim().length >= 2}{#each resaltar(f.texto, busqueda) as tramo, j (j)}{#if tramo.marca}<mark
										>{tramo.texto}</mark
									>{:else}{tramo.texto}{/if}{/each}{:else}{f.texto}{/if}{#if i === actual}<span
								class="solo-lector"
								lang="en"
							>
								(now playing)</span
							>{/if}
					</p>
					{#if data.glosasPorFragmento[f.id]}
						<div class="glosas">
							{#each data.glosasPorFragmento[f.id] as g, j (j)}
								{#if g.tipo === 'pasaje'}
									<aside class="glosa pasaje" aria-label="Scripture cited at {folio(g.momentoMs)}">
										<p class="referencia">{g.referencia}</p>
										<p class="rotulo" lang="en">
											{g.origen === 'dicho' ? 'Said at' : 'Shown on screen at'}
											<a
												class="folio"
												href="{pagina}?t={Math.floor(g.momentoMs / 1000)}"
												onclick={(e) => saltarA(e, g.momentoMs)}>¶ {folio(g.momentoMs)}</a
											>
										</p>
									</aside>
								{:else}
									<aside
										class="glosa pantalla"
										aria-label="Shown on screen at {folio(g.momentoMs)}"
									>
										<Fotograma
											videoId={data.video.id}
											segundo={g.momentoMs / 1000}
											clase="cuadro"
										/>
										<p class="rotulo" lang="en">
											Shown on screen at
											<a
												class="folio"
												href="{pagina}?t={Math.floor(g.momentoMs / 1000)}"
												onclick={(e) => saltarA(e, g.momentoMs)}>¶ {folio(g.momentoMs)}</a
											>
										</p>
										<p class="escrito">{g.texto}</p>
									</aside>
								{/if}
							{/each}
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</article>

{#if (lejos && haSonado) || coincidencias.length}
	<!-- Dock flotante: volver a lo que suena y recorrer lo encontrado, sin subir hasta la lámina. -->
	<div class="dock" role="group" aria-label="Transcript shortcuts">
		{#if coincidencias.length}
			<button
				type="button"
				class="fantasma"
				aria-label="Previous match"
				onclick={() => irACoincidencia(-1)}>‹</button
			>
			<span class="cuenta" aria-hidden="true">{posicion + 1} / {coincidencias.length}</span>
			<button
				type="button"
				class="fantasma"
				aria-label="Next match"
				onclick={() => irACoincidencia(1)}>›</button
			>
		{/if}
		{#if lejos && haSonado}
			<button type="button" onclick={volverALoQueSuena}>Back to what's playing</button>
		{/if}
	</div>
{/if}

<style>
	/*
	 * La página como un folio: margen interior para la numeración (los minutos), columna de
	 * texto a medida de lectura, margen de glosas y la lámina con el video.
	 */
	.manuscrito {
		--folio: 4.5rem;
		--hueco: 1.5rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		row-gap: var(--e-6);
		max-width: 100rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) 6rem;
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
		max-width: var(--medida);
	}

	.dato {
		color: var(--suave);
		font-family: var(--letra-interfaz);
		margin: var(--e-2) 0 0;
	}

	.resumen {
		max-width: var(--medida);
		margin: var(--e-4) 0 0;
		font-size: var(--t-1);
	}

	/* ── Lámina ── */
	.lamina {
		display: grid;
		gap: var(--e-4);
		align-content: start;
	}

	.iluminacion {
		margin: 0;
		border-radius: var(--radio-l);
		overflow: hidden;
		box-shadow: var(--sombra-2);
		background: #000;
	}

	video {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
	}

	.herramientas {
		display: grid;
		gap: var(--e-2);
		padding: var(--e-4);
		border-radius: var(--radio-m);
		background: var(--papel);
		font-family: var(--letra-interfaz);
	}

	.buscar-video label {
		display: block;
		margin-bottom: var(--e-1);
	}

	.guardar-pasaje {
		justify-self: start;
		margin-top: var(--e-1);
	}

	.buscar-video .fila {
		display: flex;
		gap: var(--e-1);
	}

	.buscar-video .campo-buscar {
		flex: 1;
		min-width: 0;
	}

	.buscar-video button {
		width: 2.75rem;
		padding: 0;
	}

	.estado {
		min-height: 1.4em;
		margin: var(--e-1) 0 0;
		color: var(--suave);
		font-size: var(--t-0);
	}

	.indice {
		padding: 0 var(--e-1);
		font-family: var(--letra-interfaz);
	}

	.indice h2 {
		margin-bottom: var(--e-3);
		font-family: var(--letra-texto);
		font-size: var(--t-2);
		font-style: italic;
	}

	.temas,
	.pasajes {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.temas {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
		margin-bottom: var(--e-4);
	}

	.pasajes li {
		display: flex;
		align-items: baseline;
		gap: var(--e-3);
		padding: 0.3rem 0;
		border-top: 1px solid var(--linea);
	}

	.pasajes .folio {
		min-width: 4.5rem;
		text-align: right;
		text-decoration: none;
	}

	.pasajes .folio:hover {
		text-decoration: underline;
	}

	/* ── Transcripción ── */
	.texto {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.texto li {
		position: relative;
		display: grid;
		grid-template-columns: var(--folio) minmax(0, var(--medida));
		column-gap: var(--hueco);
		align-items: baseline;
		scroll-margin-block: 30vh;
	}

	/* El hilo de lectura: un tramo por fragmento; lo ya sonado en tinta suave, lo que suena en tinta. */
	.texto li::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--folio) + var(--hueco) / 2 - 1px);
		border-left: 2px solid var(--linea);
	}

	.texto li.pasado::before {
		border-color: var(--pauta);
	}

	.texto li[aria-current='true']::before {
		border-color: var(--tinta);
	}

	.texto li > p {
		margin: 0 0 1rem;
		font-size: var(--t-1);
		line-height: 1.7;
		hyphens: auto;
	}

	.texto .folio {
		justify-self: end;
		font-size: var(--t-0);
		padding: 0.15rem 0;
		text-decoration: none;
	}

	.texto .folio:hover {
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

	[aria-current='true'] > p {
		border-radius: var(--radio-s);
		background: var(--papel-alto);
		box-shadow:
			-0.6rem 0 0 var(--papel-alto),
			0.6rem 0 0 var(--papel-alto),
			var(--sombra-1);
	}

	.hallado > p {
		outline: 2px solid var(--suave);
		outline-offset: 0.35rem;
		border-radius: 2px;
	}

	/* ── Glosas: bajo su frase en columna; en el margen, con su hilo, cuando hay sitio ── */
	.glosas {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		gap: var(--e-3);
		margin: 0 0 1.25rem;
	}

	.glosa.pasaje {
		flex: 0 1 auto;
	}

	.glosa.pantalla {
		flex: 0 1 18rem;
	}

	.glosa .rotulo .folio {
		font-size: var(--t-1);
		text-decoration: underline;
	}

	.referencia {
		font-family: var(--letra-texto);
		font-size: var(--t-2);
		font-style: italic;
		line-height: 1.2;
	}

	.glosa :global(.cuadro) {
		margin: calc(var(--e-3) * -1) calc(var(--e-4) * -1) var(--e-3);
		border-radius: var(--radio-m) var(--radio-m) 0 0;
	}

	.escrito {
		margin-top: var(--e-2);
		font-family: var(--letra-texto);
		white-space: pre-line;
		hyphens: none;
	}

	/* ── Dock flotante ── */
	.dock {
		position: fixed;
		left: 50%;
		bottom: var(--e-6);
		z-index: 10;
		display: flex;
		align-items: center;
		gap: var(--e-1);
		padding: var(--e-1);
		border: 1px solid var(--linea);
		border-radius: 999px;
		background: var(--papel-alto);
		box-shadow: var(--sombra-2);
		font-family: var(--letra-interfaz);
		transform: translateX(-50%);
	}

	.dock button {
		border-radius: 999px;
	}

	.dock .fantasma {
		width: 2.75rem;
		padding: 0;
		font-size: var(--t-2);
	}

	.cuenta {
		min-width: 3.5rem;
		text-align: center;
		color: var(--suave);
		font-variant-numeric: tabular-nums;
	}

	/* ── Disposición según el ancho ── */
	@media (max-width: 40rem) {
		.texto li {
			grid-template-columns: minmax(0, 1fr);
			padding-left: var(--e-4);
		}
		.texto li::before {
			left: 0;
		}
		.texto .folio {
			justify-self: start;
		}
		.glosas {
			grid-column: 1;
		}
	}

	/* Tres pistas: folio | texto | lámina fija. Las glosas siguen bajo su frase. */
	@media (min-width: 68rem) {
		.manuscrito {
			grid-template-columns: var(--folio) minmax(0, var(--medida)) minmax(20rem, 1fr);
			column-gap: var(--hueco);
		}
		.encabezado {
			grid-column: 2;
			grid-row: 1;
		}
		.texto,
		.manuscrito > .dato {
			grid-column: 1 / 3;
			grid-row: 2;
		}
		.lamina {
			grid-column: 3;
			grid-row: 1 / 3;
			align-self: start;
			position: sticky;
			top: calc(var(--alto-cabecera) + var(--e-4));
			max-height: calc(100vh - var(--alto-cabecera) - var(--e-8));
			overflow-y: auto;
			margin-left: var(--e-6);
			padding: 6px;
		}
	}

	/* Cuatro pistas: folio | texto | glosas al margen | lámina. */
	@media (min-width: 84rem) {
		.manuscrito {
			grid-template-columns: var(--folio) minmax(0, var(--medida)) 14rem minmax(20rem, 1fr);
		}
		.encabezado {
			grid-column: 2 / 4;
		}
		.texto,
		.manuscrito > .dato {
			grid-column: 1 / 4;
		}
		.lamina {
			grid-column: 4;
		}
		.texto li {
			grid-template-columns: var(--folio) minmax(0, var(--medida)) 14rem;
		}
		.glosas {
			grid-column: 3;
			grid-row: 1 / span 2;
			display: grid;
			align-self: start;
			margin-left: var(--e-4);
			--hilo: calc(var(--e-4) + var(--hueco) - var(--e-2));
			--hilo-punto: 1;
		}
		/* Un solo hilo por frase: las glosas siguientes cuelgan de la primera. */
		.glosas .glosa + .glosa {
			--hilo: 0;
			--hilo-punto: 0;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.dock {
			animation: aparecer var(--dur-media) var(--curva) both;
		}
		[aria-current='true'] > p {
			transition: background-color var(--dur-corta) var(--curva);
		}
		@keyframes aparecer {
			from {
				opacity: 0;
				transform: translate(-50%, 0.75rem);
			}
		}
	}
</style>
