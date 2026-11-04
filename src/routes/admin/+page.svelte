<script lang="ts">
	import { enhance } from '$app/forms';
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import { duracion, folio } from '#lib/formato.js';
	import EditorSerie from './EditorSerie.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const NOMBRES_PASO: Record<string, string> = {
		normalizar: 'Prepare video',
		transcribir: 'Transcribe',
		sensibles: 'Check sensitive passages',
		ficha: 'Draft summary',
		pasajes: 'Index Scripture',
		pantalla: 'Read the screen'
	};
	const ESTADO_PASO: Record<string, string> = {
		pendiente: 'waiting',
		en_curso: 'in progress',
		hecho: 'done',
		fallido: 'failed'
	};
	const ESTADO_VIDEO: Record<string, string> = {
		listo: 'Ready',
		procesando: 'Processing',
		con_errores: 'Needs a retry'
	};
	const CATEGORIA: Record<string, string> = {
		salud: 'Health of a private person',
		fallecimiento: 'Death or mourning',
		menores: 'A minor',
		persona_privada: 'Private matter'
	};

	/* ── Secciones: viven en la URL (?s=, ?v=, ?serie=) para enlazarlas y volver con Atrás ── */
	type Seccion = 'revisar' | 'videos' | 'subir' | 'series' | 'temas' | 'publicadas';
	const SECCIONES: Seccion[] = ['revisar', 'videos', 'subir', 'series', 'temas', 'publicadas'];
	const NOMBRE_SECCION: Record<Seccion, string> = {
		revisar: 'To review',
		videos: 'Videos',
		subir: 'Add a video',
		series: 'Series',
		temas: 'Topics',
		publicadas: 'Published'
	};

	const seccion = $derived.by<Seccion>(() => {
		const s = page.url.searchParams.get('s') as Seccion | null;
		return s && SECCIONES.includes(s) ? s : 'revisar';
	});
	const consulta = (parametros: Record<string, string>) => String(new URLSearchParams(parametros));

	const sensibles = $derived(
		data.autenticado ? data.pendientes.filter((p) => p.tipo === 'fragmento_sensible') : []
	);
	const fichas = $derived(
		data.autenticado ? data.pendientes.filter((p) => p.tipo !== 'fragmento_sensible') : []
	);
	const cuentas = $derived<Record<Seccion, number | null>>(
		data.autenticado
			? {
					revisar: sensibles.length + fichas.length + data.resumenesSerie.length,
					videos: data.videos.length,
					subir: null,
					series: data.series.length,
					temas: data.etiquetas.length,
					publicadas: data.publicadas.length
				}
			: { revisar: 0, videos: 0, subir: null, series: 0, temas: 0, publicadas: 0 }
	);

	/** Al cambiar de sección o de elemento, el foco va al título de lo que se abrió. */
	afterNavigate(async ({ from, to, type }) => {
		if (type === 'enter' || !from || !to || from.url.pathname !== to.url.pathname) return;
		await tick();
		const v = to.url.searchParams.get('v') ?? to.url.searchParams.get('serie');
		document.getElementById(v ? 'detalle-titulo' : 'panel-titulo')?.focus();
	});

	/* ── Videos: búsqueda y filtro por estado ── */
	type Filtro = 'todos' | 'con_errores' | 'procesando' | 'listo';
	let busqueda = $state('');
	let filtro = $state<Filtro>('todos');
	const normalizar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
	const porEstado = $derived.by(() => {
		const c = { todos: 0, con_errores: 0, procesando: 0, listo: 0 };
		if (!data.autenticado) return c;
		for (const v of data.videos) {
			c.todos++;
			c[v.estado]++;
		}
		return c;
	});
	const filtrados = $derived.by(() => {
		if (!data.autenticado) return [];
		const q = normalizar(busqueda.trim());
		return data.videos.filter(
			(v) => (filtro === 'todos' || v.estado === filtro) && (!q || normalizar(v.titulo).includes(q))
		);
	});
	const videoElegido = $derived(
		data.autenticado ? data.videos.find((v) => v.id === page.url.searchParams.get('v')) : undefined
	);
	/* La fila elegida queda a la vista al llegar por un enlace directo (?v=…). */
	$effect(() => {
		void videoElegido;
		void serieElegida;
		tick().then(() => {
			// Solo se mueve la lista: scrollIntoView desplazaría también la página.
			const fila = document.querySelector<HTMLElement>('.fila[aria-current="true"]');
			const lista = fila?.closest<HTMLElement>('.lista');
			if (!fila || !lista || lista.scrollHeight <= lista.clientHeight) return;
			const arriba = fila.offsetTop; // relativo a la lista, que está posicionada
			if (
				arriba < lista.scrollTop ||
				arriba + fila.offsetHeight > lista.scrollTop + lista.clientHeight
			) {
				lista.scrollTop = arriba - lista.clientHeight / 2 + fila.offsetHeight / 2;
			}
		});
	});
	const pasosHechos = (pasos: Array<{ estado: string }>) =>
		pasos.filter((p) => p.estado === 'hecho').length;

	/* ── Series ── */
	const serieElegida = $derived(
		data.autenticado
			? data.series.find((s) => s.id === page.url.searchParams.get('serie'))
			: undefined
	);
	const creandoSerie = $derived(page.url.searchParams.get('serie') === 'nueva');

	/* ── Subida ── */
	let titulo = $state('');
	let youtube = $state('');
	let avisoYoutube = $state('');

	/**
	 * Al pegar el enlace de YouTube, su título rellena el campo si estaba vacío; si ya había uno,
	 * no se toca (spec origen-youtube). El enlace se valida en el servidor antes de pedir nada.
	 */
	async function consultarYoutube() {
		avisoYoutube = '';
		if (!youtube.trim()) return;
		avisoYoutube = 'Looking it up on YouTube…';
		try {
			const r = await fetch(`/api/youtube?url=${encodeURIComponent(youtube.trim())}`);
			const datos = await r.json();
			if (!r.ok) {
				avisoYoutube = datos.error ?? 'YouTube did not answer.';
				return;
			}
			if (!titulo.trim()) {
				titulo = datos.titulo;
				avisoYoutube = `Title filled in from YouTube (${datos.canal}). You can edit it.`;
			} else {
				avisoYoutube = `Linked to “${datos.titulo}” (${datos.canal}). Your title was kept.`;
			}
		} catch {
			avisoYoutube = 'YouTube did not answer. The link will still be saved.';
		}
	}
	let archivo = $state<FileList>();
	let selector = $state<HTMLInputElement>();
	let encima = $state(false);
	let progreso = $state<number | null>(null);
	let mensajeSubida = $state('');

	const elegido = $derived(archivo?.[0]);
	const tamano = (bytes: number) =>
		bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;

	/** Soltar un archivo en la zona equivale a elegirlo con el selector (que sigue ahí para el teclado). */
	function soltar(evento: DragEvent) {
		evento.preventDefault();
		encima = false;
		const archivos = evento.dataTransfer?.files;
		if (!archivos?.length || !selector) return;
		selector.files = archivos;
		archivo = archivos;
	}

	/** Sube con XMLHttpRequest para poder mostrar el avance: un video pesa cientos de MB. */
	function subir(evento: SubmitEvent) {
		evento.preventDefault();
		if (!elegido || !titulo.trim()) return;
		const peticion = new XMLHttpRequest();
		const conEnlace = youtube.trim() ? `&youtube=${encodeURIComponent(youtube.trim())}` : '';
		peticion.open('POST', `/api/videos?titulo=${encodeURIComponent(titulo.trim())}${conEnlace}`);
		peticion.setRequestHeader('Content-Type', 'application/octet-stream');
		peticion.upload.onprogress = (e) => {
			if (e.lengthComputable) progreso = Math.round((e.loaded / e.total) * 100);
		};
		peticion.onload = () => {
			progreso = null;
			if (peticion.status === 202) {
				mensajeSubida = `Uploaded “${titulo.trim()}”. It is being processed; follow it in Videos.`;
				titulo = '';
				youtube = '';
				avisoYoutube = '';
				void invalidateAll();
			} else {
				let detalle = peticion.statusText;
				try {
					detalle = JSON.parse(peticion.responseText).message ?? detalle;
				} catch {
					// Respuesta sin JSON: se muestra el estado HTTP.
				}
				mensajeSubida = `The upload failed: ${detalle}`;
			}
		};
		peticion.onerror = () => {
			progreso = null;
			mensajeSubida = 'The upload failed: the connection was interrupted. Try again.';
		};
		mensajeSubida = '';
		progreso = 0;
		peticion.send(elegido);
	}
</script>

<svelte:head>
	<title>Editor — Glosa</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet icono(estado: string)}
	<svg viewBox="0 0 16 16" aria-hidden="true">
		{#if estado === 'hecho' || estado === 'listo'}
			<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4" /><path
				d="M5 8.2l2 2 4-4.4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		{:else if estado === 'fallido' || estado === 'con_errores'}
			<path
				d="M8 1.8L15 14H1z M8 6v4 M8 11.6v.4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		{:else if estado === 'en_curso' || estado === 'procesando'}
			<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4" /><path
				d="M8 4.5V8l2.5 1.5"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linecap="round"
			/>
		{:else}
			<circle
				cx="8"
				cy="8"
				r="6.5"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-dasharray="2 2.2"
			/>
		{/if}
	</svg>
{/snippet}

{#if !data.autenticado}
	<div class="acceso">
		<div class="entrada tarjeta">
			<h1>Editor</h1>
			{#if !data.configurado}
				<p class="nota">
					The editor is off: this server has no editor key yet. Whoever installs Glosa chooses it.
				</p>
				<ol class="instrucciones">
					<li>
						Generate a long random key:
						<code
							>node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"</code
						>
					</li>
					<li>Put it in the server’s <code>.env</code> as <code>ADMIN_TOKEN=…</code></li>
					<li>Restart Glosa and sign in here with that same key.</li>
				</ol>
			{:else}
				<p class="nota">Upload videos and review what Glosa drafted before it goes public.</p>
				<form method="post" action="?/entrar" use:enhance>
					<label for="clave">Editor key</label>
					<input
						id="clave"
						name="clave"
						type="password"
						autocomplete="current-password"
						required
						aria-describedby="pista-clave{form && 'error' in form ? ' error-clave' : ''}"
					/>
					<p id="pista-clave" class="pista">
						The <code>ADMIN_TOKEN</code> value set by whoever installed this server.
					</p>
					{#if form && 'error' in form}<p id="error-clave" class="error">{form.error}</p>{/if}
					<button type="submit">Sign in</button>
				</form>
			{/if}
		</div>
	</div>
{:else}
	<div class="app">
		<!-- ── Riel: secciones con su cuenta, gasto y salida ── -->
		<aside class="riel" aria-label="Editor">
			<h1>Editor</h1>
			<nav aria-label="Editor sections">
				<ul>
					{#each SECCIONES as s (s)}
						<li>
							<a
								href="{resolve('/admin')}?{consulta({ s })}"
								aria-current={seccion === s ? 'page' : undefined}
								class:alerta={s === 'revisar' && (cuentas.revisar ?? 0) > 0}
							>
								<span>{NOMBRE_SECCION[s]}</span>
								{#if cuentas[s] !== null}<span class="cuenta"
										><span class="solo-lector">, </span>{cuentas[s]}</span
									>{/if}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
			<div class="pie-riel">
				<p class="gasto" class:alcanzado={data.topeAlcanzado}>
					<span class="cifra">US${data.gastoHoy.toFixed(2)}</span>
					<span class="gasto-largo">spent on AI</span> today{#if data.topeAlcanzado}. The daily
						limit is reached: visitors cannot ask questions until tomorrow{/if}.
				</p>
				<form method="post" action="?/salir" use:enhance>
					<button type="submit" class="secundario">Sign out</button>
				</form>
			</div>
		</aside>

		<!-- ── Panel de la sección: cabecera fija y cuerpo con su propio desplazamiento ── -->
		<section class="panel tarjeta" aria-labelledby="panel-titulo">
			<header class="panel-cabeza">
				<h2 id="panel-titulo" tabindex="-1">{NOMBRE_SECCION[seccion]}</h2>
				{#if seccion === 'revisar'}
					<p class="nota">
						Nothing reaches the public until you decide. Private information about other people
						comes first.
					</p>
				{:else if seccion === 'videos'}
					<div class="herramientas">
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
							<label class="solo-lector" for="buscar-videos">Find a video by title</label>
							<input
								id="buscar-videos"
								type="search"
								bind:value={busqueda}
								placeholder="Find a video by title"
								autocomplete="off"
							/>
						</div>
						<div class="filtros" role="group" aria-label="Show">
							{#each [['todos', 'All'], ['con_errores', 'Needs a retry'], ['procesando', 'Processing'], ['listo', 'Ready']] as [clave, nombre] (clave)}
								<button
									type="button"
									class="chip"
									aria-pressed={filtro === clave}
									onclick={() => (filtro = clave as Filtro)}
									>{nombre} <span class="cuenta">{porEstado[clave as Filtro]}</span></button
								>
							{/each}
						</div>
					</div>
				{:else if seccion === 'subir'}
					<p class="nota">
						Only upload videos you have permission to publish. Glosa transcribes them, hides
						anything that looks like private information about other people, and drafts a summary
						for you to review.
					</p>
				{:else if seccion === 'series'}
					<p class="nota">
						Group videos so visitors can watch them in order and ask questions that only those
						videos answer.
					</p>
				{:else if seccion === 'temas'}
					<p class="nota">
						Topics come from the summaries you approve. Merge two that mean the same: the first one
						disappears and its videos move to the second.
					</p>
				{:else if seccion === 'publicadas'}
					<p class="nota">
						Visitors can publish what they write. Unpublishing removes the read link; its author
						cannot publish it again.
					</p>
				{/if}
				{#if form && 'error' in form}<p class="error" role="alert">{form.error}</p>{/if}
			</header>

			<!-- ── Revisar ── -->
			{#if seccion === 'revisar'}
				<div
					class="panel-cuerpo desplazable"
					role="region"
					aria-label="Items to review"
					tabindex="-1"
				>
					{#if cuentas.revisar === 0}
						<div class="vacio">
							<p>Nothing waits for a decision.</p>
							<a href="{resolve('/admin')}?{consulta({ s: 'subir' })}">Add a video</a>
						</div>
					{/if}

					{#if sensibles.length}
						<h3>
							Private information about other people <span class="cuenta">{sensibles.length}</span>
						</h3>
						<p class="nota">
							These passages are hidden from the public. Publish one only if the people it mentions
							would agree.
						</p>
						<ul class="cola">
							{#each sensibles as p (p.id)}
								<li class="item">
									<p class="contexto">
										<span lang="es">{p.titulo}</span>
										{#if p.inicioMs !== null}<span class="folio">¶ {folio(p.inicioMs)}</span>{/if}
										<span class="insignia">{CATEGORIA[p.categoria ?? ''] ?? p.categoria}</span>
									</p>
									<p class="categoria" lang="es">{p.contenido}</p>
									<blockquote lang="es">{p.texto}</blockquote>
									<form method="post" action="?/decidir" use:enhance class="decision">
										<input type="hidden" name="id" value={p.id} />
										<button name="decision" value="oculto" type="submit">Keep hidden</button>
										<button name="decision" value="aprobado" type="submit" class="secundario"
											>Publish</button
										>
									</form>
								</li>
							{/each}
						</ul>
					{/if}

					{#if fichas.length}
						<h3>Summaries and topics drafted by AI <span class="cuenta">{fichas.length}</span></h3>
						<ul class="cola">
							{#each fichas as p (p.id)}
								<li class="item">
									<p class="contexto">
										<span lang="es">{p.titulo}</span>
										<span class="insignia">{p.tipo === 'resumen' ? 'summary' : 'topics'}</span>
									</p>
									<blockquote lang="es">
										{p.tipo === 'temas' ? JSON.parse(p.contenido).join(', ') : p.contenido}
									</blockquote>
									<form method="post" action="?/decidir" use:enhance class="decision">
										<input type="hidden" name="id" value={p.id} />
										<button name="decision" value="aprobado" type="submit">Approve</button>
										<button name="decision" value="oculto" type="submit" class="secundario"
											>Discard</button
										>
									</form>
								</li>
							{/each}
						</ul>
					{/if}

					{#if data.resumenesSerie.length}
						<h3>
							Series overviews drafted by AI <span class="cuenta">{data.resumenesSerie.length}</span
							>
						</h3>
						<ul class="cola">
							{#each data.resumenesSerie as r (r.id)}
								<li class="item">
									<p class="contexto">
										<span lang="es">{r.nombre}</span>
										<span class="insignia">series overview</span>
									</p>
									<blockquote lang="es">{r.contenido}</blockquote>
									<form method="post" action="?/decidirResumenSerie" use:enhance class="decision">
										<input type="hidden" name="id" value={r.id} />
										<button name="decision" value="aprobado" type="submit">Approve</button>
										<button name="decision" value="oculto" type="submit" class="secundario"
											>Discard</button
										>
									</form>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<!-- ── Videos: lista y detalle, cada uno con su desplazamiento ── -->
			{:else if seccion === 'videos'}
				<div class="maestro-detalle" class:con-detalle={videoElegido}>
					<div class="lista desplazable" role="region" aria-label="Video list" tabindex="-1">
						<p class="resumen-lista" role="status">
							{filtrados.length === data.videos.length
								? `${data.videos.length} ${data.videos.length === 1 ? 'video' : 'videos'}`
								: `Showing ${filtrados.length} of ${data.videos.length}`}
						</p>
						{#if data.videos.length === 0}
							<div class="vacio">
								<p>No videos yet.</p>
								<a href="{resolve('/admin')}?{consulta({ s: 'subir' })}">Add the first one</a>
							</div>
						{:else if filtrados.length === 0}
							<div class="vacio"><p>No video matches.</p></div>
						{/if}
						<ul class="filas">
							{#each filtrados as v (v.id)}
								<li>
									<a
										class="fila"
										href="{resolve('/admin')}?{consulta({ s: 'videos', v: v.id })}"
										aria-current={videoElegido?.id === v.id ? 'true' : undefined}
									>
										<Fotograma videoId={v.id} segundo={v.posterSegundo} clase="miniatura" />
										<span class="fila-texto">
											<span class="fila-titulo" lang="es">{v.titulo}</span>
											<span class="fila-meta estado-{v.estado}">
												{@render icono(v.estado)}
												{ESTADO_VIDEO[v.estado]}{#if v.estado === 'procesando'}
													· {pasosHechos(v.pasos)} of {v.pasos.length}{/if}{#if v.duracionMs}
													· {duracion(v.duracionMs)}{/if}
											</span>
										</span>
									</a>
								</li>
							{/each}
						</ul>
					</div>

					<div class="detalle desplazable" role="region" aria-label="Video details" tabindex="-1">
						{#if !videoElegido}
							<div class="vacio">
								<p>Choose a video to see its processing, links, privacy and captions.</p>
							</div>
						{:else}
							{@const v = videoElegido}
							{#key v.id}
								<a class="volver" href="{resolve('/admin')}?{consulta({ s: 'videos' })}"
									>← All videos</a
								>
								<div class="detalle-cabeza">
									<Fotograma videoId={v.id} segundo={v.posterSegundo} ancho={640} clase="poster" />
									<div>
										<h3 id="detalle-titulo" tabindex="-1" lang="es">{v.titulo}</h3>
										<p class="fila-meta estado-{v.estado}">
											{@render icono(v.estado)}
											{ESTADO_VIDEO[v.estado]}{#if v.duracionMs}
												· {duracion(v.duracionMs)}{/if}
										</p>
										<a href={resolve('/videos/[id]', { id: v.id })}>Open the public page</a>
									</div>
								</div>

								<section class="bloque" aria-labelledby="b-proceso">
									<h4 id="b-proceso">Processing</h4>
									<ol class="pasos">
										{#each v.pasos as paso (paso.paso)}
											<li class="insignia paso-{paso.estado}">
												{@render icono(paso.estado)}
												{NOMBRES_PASO[paso.paso] ?? paso.paso}: {ESTADO_PASO[paso.estado] ??
													paso.estado}
											</li>
										{/each}
									</ol>
									{#each v.pasos.filter((p) => p.error) as paso (paso.paso)}
										<p class="detalle-texto">
											{NOMBRES_PASO[paso.paso] ?? paso.paso}: {paso.error}
										</p>
									{/each}
									{#if v.estado === 'con_errores'}
										<form method="post" action="?/reintentar" use:enhance>
											<input type="hidden" name="videoId" value={v.id} />
											<button type="submit">Retry the failed steps</button>
										</form>
									{/if}
								</section>

								{#if v.estado === 'listo'}
									<section class="bloque" aria-labelledby="b-youtube">
										<h4 id="b-youtube">
											YouTube link{#if v.youtubeCanal}<span class="nota">
													· {v.youtubeCanal}</span
												>{/if}
										</h4>
										<form method="post" action="?/youtube" use:enhance class="fila-youtube">
											<input type="hidden" name="videoId" value={v.id} />
											<label class="solo-lector" for="yt-{v.id}">YouTube link of {v.titulo}</label>
											<input
												id="yt-{v.id}"
												name="youtube"
												type="url"
												value={v.youtubeUrl ?? ''}
												placeholder="https://youtu.be/…"
											/>
											<button type="submit" class="secundario">Save</button>
										</form>
									</section>

									<section class="bloque" aria-labelledby="b-privacidad">
										<h4 id="b-privacidad">Visual privacy</h4>
										<p class="detalle-texto" role="status">
											{v.privacidadVisual
												? 'On. Frames show the audience blurred by SAM 3.1 and clips have no picture.'
												: 'Off. Frames and clips show the video as recorded.'}
										</p>
										<form method="post" action="?/privacidad" use:enhance>
											<input type="hidden" name="videoId" value={v.id} />
											<input type="hidden" name="activa" value={v.privacidadVisual ? '0' : '1'} />
											<button type="submit" class="secundario"
												>{v.privacidadVisual ? 'Turn off' : 'Turn on'} visual privacy</button
											>
										</form>
										<details>
											<summary>Preview the blur on one frame</summary>
											<p class="detalle-texto">
												The same frame, as recorded and with everyone except the speaker blurred.
												The full video still plays as recorded.
											</p>
											<div class="antes-despues">
												<figure>
													<img
														src="{resolve('/admin/fotograma/[id]/[segundo]', {
															id: v.id,
															segundo: String(v.posterSegundo)
														})}?version=original"
														alt="Frame at {folio(v.posterSegundo * 1000)}, as recorded"
														loading="lazy"
														width="640"
														height="360"
													/>
													<figcaption>As recorded</figcaption>
												</figure>
												<figure>
													<img
														src="{resolve('/admin/fotograma/[id]/[segundo]', {
															id: v.id,
															segundo: String(v.posterSegundo)
														})}?version=difuminado"
														alt="The same frame with everyone except the speaker blurred"
														loading="lazy"
														width="640"
														height="360"
													/>
													<figcaption>With visual privacy</figcaption>
												</figure>
											</div>
										</details>
									</section>

									{@const s = v.subtitulosEn}
									<section class="bloque" aria-labelledby="b-subtitulos">
										<h4 id="b-subtitulos">English captions</h4>
										<form method="post" action="?/subtitular" use:enhance>
											<input type="hidden" name="videoId" value={v.id} />
											<p class="detalle-texto" role="status">
												{s.traducidas} of {s.total} lines{s.enCurso
													? ', translating with Muse Spark… reload to see progress'
													: ''}.
											</p>
											{#if s.total > 0}
												<progress max={s.total} value={s.traducidas} aria-hidden="true"></progress>
											{/if}
											{#if !s.enCurso && s.traducidas < s.total}
												<button type="submit" class="secundario"
													>{s.traducidas
														? 'Translate the missing lines'
														: 'Translate captions to English'}</button
												>
											{/if}
										</form>
									</section>
								{/if}
							{/key}
						{/if}
					</div>
				</div>

				<!-- ── Subir ── -->
			{:else if seccion === 'subir'}
				<div class="panel-cuerpo desplazable" role="region" aria-label="Upload form" tabindex="-1">
					<form onsubmit={subir} class="subir">
						<label for="youtube">YouTube link (optional)</label>
						<input
							id="youtube"
							type="url"
							inputmode="url"
							bind:value={youtube}
							onchange={consultarYoutube}
							placeholder="https://youtu.be/…"
							aria-describedby="pista-youtube aviso-youtube"
						/>
						<p id="pista-youtube" class="pista">
							Where this video is published. Glosa only links to it, at the right minute; you still
							upload the file.
						</p>
						<p id="aviso-youtube" class="pista" role="status">{avisoYoutube}</p>
						<label for="titulo">Title</label>
						<input id="titulo" type="text" bind:value={titulo} required maxlength="200" />
						<label for="archivo">Video file (mp4)</label>
						<div
							class="zona"
							class:encima
							role="presentation"
							ondragover={(e) => {
								e.preventDefault();
								encima = true;
							}}
							ondragleave={() => (encima = false)}
							ondrop={soltar}
						>
							<input
								id="archivo"
								type="file"
								accept="video/*"
								bind:this={selector}
								bind:files={archivo}
								required
								aria-describedby="pista-archivo"
							/>
							<p id="pista-archivo" class="pista">
								{#if elegido}
									<span lang="es">{elegido.name}</span>, {tamano(elegido.size)}
								{:else}
									Choose a file, or drop it here.
								{/if}
							</p>
						</div>
						<button type="submit" disabled={progreso !== null}>Upload</button>
					</form>
					<div role="status" aria-live="polite" class="estado-subida">
						{#if progreso !== null}
							<label class="avance"
								>Uploading <progress max="100" value={progreso}>{progreso}%</progress>
								{progreso}%</label
							>
						{/if}
						{#if mensajeSubida}<p class="mensaje">{mensajeSubida}</p>{/if}
					</div>
				</div>

				<!-- ── Series: lista y editor ── -->
			{:else if seccion === 'series'}
				<div class="maestro-detalle" class:con-detalle={serieElegida || creandoSerie}>
					<div class="lista desplazable" role="region" aria-label="Series list" tabindex="-1">
						<a
							class="boton secundario nueva"
							href="{resolve('/admin')}?{consulta({ s: 'series', serie: 'nueva' })}"
							aria-current={creandoSerie ? 'true' : undefined}>New series</a
						>
						{#if data.series.length === 0}
							<div class="vacio"><p>No series yet.</p></div>
						{/if}
						<ul class="filas">
							{#each data.series as s (s.id)}
								<li>
									<a
										class="fila fila-serie"
										href="{resolve('/admin')}?{consulta({ s: 'series', serie: s.id })}"
										aria-current={serieElegida?.id === s.id ? 'true' : undefined}
									>
										<span class="fila-texto">
											<span class="fila-titulo" lang="es">{s.nombre}</span>
											<span class="fila-meta"
												>{s.videoIds.length}
												{s.videoIds.length === 1 ? 'video' : 'videos'}{#if s.tieneResumen}
													· with overview{/if}</span
											>
										</span>
									</a>
								</li>
							{/each}
						</ul>
					</div>

					<div class="detalle desplazable" role="region" aria-label="Series editor" tabindex="-1">
						{#if creandoSerie}
							<a class="volver" href="{resolve('/admin')}?{consulta({ s: 'series' })}"
								>← All series</a
							>
							<h3 id="detalle-titulo" tabindex="-1">New series</h3>
							<form method="post" action="?/crearSerie" use:enhance class="nueva-serie">
								<label for="nueva-nombre">Name</label>
								<input id="nueva-nombre" name="nombre" type="text" required maxlength="80" />
								<label for="nueva-descripcion">Description (optional)</label>
								<textarea id="nueva-descripcion" name="descripcion" rows="3" maxlength="600"
								></textarea>
								<p class="pista">You add its videos after creating it.</p>
								<div><button type="submit">Create the series</button></div>
							</form>
							{#if form && 'serieCreada' in form && form.serieCreada}
								<p role="status" class="mensaje">
									Created.
									<a
										href="{resolve('/admin')}?{consulta({
											s: 'series',
											serie: String(form.serieCreada)
										})}">Add its videos</a
									>
								</p>
							{/if}
						{:else if serieElegida}
							<a class="volver" href="{resolve('/admin')}?{consulta({ s: 'series' })}"
								>← All series</a
							>
							<h3 id="detalle-titulo" tabindex="-1" lang="es">{serieElegida.nombre}</h3>
							{#key serieElegida.id}
								<EditorSerie serie={serieElegida} videos={data.videos} />
							{/key}
						{:else}
							<div class="vacio">
								<p>Choose a series to edit it, or create a new one.</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- ── Temas ── -->
			{:else if seccion === 'temas'}
				<div class="panel-cuerpo desplazable" role="region" aria-label="Topics" tabindex="-1">
					{#if data.etiquetas.length < 2}
						<p class="nota">There are not two topics to merge yet.</p>
					{:else}
						<form method="post" action="?/fusionarEtiquetas" use:enhance class="fusionar">
							<div>
								<label for="absorbida">Merge</label>
								<select id="absorbida" name="absorbida" required>
									{#each data.etiquetas as e (e.id)}
										<option value={e.id} lang="es">{e.nombre} ({e.usos})</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="destino">into</label>
								<select id="destino" name="destino" required>
									{#each data.etiquetas as e (e.id)}
										<option value={e.id} lang="es">{e.nombre} ({e.usos})</option>
									{/each}
								</select>
							</div>
							<button type="submit">Merge</button>
						</form>
					{/if}
					{#if data.etiquetas.length}
						<h3>All topics</h3>
						<ul class="etiquetas">
							{#each data.etiquetas as e (e.id)}
								<li>
									<a href={resolve('/topics/[slug]', { slug: e.slug })} lang="es">{e.nombre}</a>
									<span class="nota">{e.usos} {e.usos === 1 ? 'video' : 'videos'}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<!-- ── Publicadas ── -->
			{:else if seccion === 'publicadas'}
				<div
					class="panel-cuerpo desplazable"
					role="region"
					aria-label="Published investigations"
					tabindex="-1"
				>
					{#if data.publicadas.length === 0}
						<div class="vacio"><p>None published.</p></div>
					{:else}
						<ul class="publicadas">
							{#each data.publicadas as inv (inv.id)}
								<li>
									<a href={resolve('/investigations/[id]', { id: inv.id })}>{inv.titulo}</a>
									<span class="nota">{inv.bloques} blocks</span>
									<form method="post" action="?/retirar" use:enhance>
										<input type="hidden" name="id" value={inv.id} />
										<button type="submit" class="secundario"
											>Unpublish<span class="solo-lector"> {inv.titulo}</span></button
										>
									</form>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</section>
	</div>
{/if}

<style>
	/* ── Acceso ── */
	.acceso {
		display: grid;
		place-items: center;
		min-height: calc(100dvh - var(--alto-cabecera));
		padding: var(--e-8) var(--margen);
	}

	.entrada {
		width: min(100%, 30rem);
		padding: var(--e-8);
	}

	.entrada button {
		width: 100%;
		margin-top: var(--e-6);
	}

	.instrucciones {
		display: grid;
		gap: var(--e-3);
		margin: var(--e-6) 0 0;
		padding-left: 1.25rem;
		font-family: var(--letra-interfaz);
	}

	code {
		padding: 0.05em 0.35em;
		border-radius: 4px;
		background: var(--papel);
		font-size: 0.88em;
		overflow-wrap: anywhere;
	}

	.instrucciones code {
		display: block;
		margin-top: var(--e-1);
		padding: var(--e-2) var(--e-3);
	}

	/*
	 * ── La app ──
	 * Ocupa exactamente el alto de la ventana bajo la cabecera, con márgenes fijos en los cuatro
	 * lados: la página no crece con el contenido; crece el desplazamiento de cada panel.
	 */
	.app {
		display: grid;
		grid-template-columns: 14rem minmax(0, 1fr);
		gap: var(--e-6);
		box-sizing: border-box;
		/* El borde inferior de la cabecera (1 px) no entra en --alto-cabecera. */
		height: calc(100dvh - var(--alto-cabecera) - 1px);
		max-width: 100rem;
		margin: 0 auto;
		padding: var(--e-6) var(--margen);
	}

	h1 {
		margin: 0;
		font-size: var(--t-3);
		font-style: italic;
	}

	/* ── Riel ── */
	.riel {
		display: flex;
		flex-direction: column;
		gap: var(--e-6);
		min-height: 0;
	}

	.riel ul {
		display: grid;
		gap: var(--e-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.riel nav a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--e-2);
		min-height: 2.75rem;
		padding: 0 var(--e-3);
		border-radius: var(--radio-s);
		color: var(--tinta);
		font-family: var(--letra-interfaz);
		font-size: var(--t-1);
		text-decoration: none;
	}

	.riel nav a:hover {
		background: var(--papel);
	}

	.riel nav a[aria-current='page'] {
		background: var(--tinta);
		color: var(--fondo);
	}

	.cuenta {
		display: inline-grid;
		place-items: center;
		min-width: 1.6rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: var(--papel);
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
		font-style: normal;
		font-weight: 500;
		line-height: 1.5;
		font-variant-numeric: tabular-nums;
	}

	.riel nav a[aria-current='page'] .cuenta {
		background: color-mix(in srgb, var(--fondo) 18%, var(--tinta));
		color: var(--fondo);
	}

	/* Lo que espera decisión se ve, y no solo por el color: la cuenta cambia de forma. */
	.riel nav a.alerta .cuenta {
		background: var(--rubrica);
		color: #fff;
		font-weight: 700;
	}

	.pie-riel {
		display: grid;
		gap: var(--e-3);
		margin-top: auto;
		padding-top: var(--e-4);
		border-top: 1px solid var(--linea);
	}

	.gasto {
		margin: 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	.gasto .cifra {
		display: block;
		color: var(--tinta);
		font-size: var(--t-2);
		font-variant-numeric: tabular-nums;
	}

	.gasto.alcanzado {
		color: var(--tinta);
		font-weight: 500;
	}

	.gasto.alcanzado .cifra {
		color: var(--rubrica);
	}

	/* ── Panel ── */
	.panel {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 0;
		overflow: hidden;
	}

	.panel-cabeza {
		display: grid;
		gap: var(--e-2);
		padding: var(--e-6) var(--e-6) var(--e-4);
		border-bottom: 1px solid var(--linea);
	}

	h2 {
		margin: 0;
		font-size: var(--t-3);
		font-style: italic;
		outline: none;
	}

	.panel-cuerpo {
		position: relative;
		min-height: 0;
		overflow: auto;
		padding: var(--e-4) var(--e-6) var(--e-8);
		outline: none;
	}

	.herramientas {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2) var(--e-4);
		margin-top: var(--e-2);
	}

	.herramientas .campo-buscar {
		flex: 1 1 16rem;
		max-width: 26rem;
	}

	.herramientas input {
		width: 100%;
	}

	.filtros {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-1);
	}

	.filtros .cuenta {
		margin-left: 0.2rem;
	}

	.filtros [aria-pressed='true'] .cuenta {
		background: color-mix(in srgb, var(--fondo) 18%, var(--tinta));
		color: var(--fondo);
	}

	/* ── Maestro-detalle ── */
	.maestro-detalle {
		display: grid;
		grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
		min-height: 0;
	}

	/*
	 * `position: relative` en cada zona con desplazamiento: sin ella, los textos `.solo-lector`
	 * (absolutos) se ubican respecto a la página, escapan del recorte y la alargan.
	 */
	.lista,
	.detalle {
		position: relative;
		min-height: 0;
		overflow: auto;
		outline: none;
	}

	.lista {
		padding: var(--e-3) var(--e-2) var(--e-6);
		border-right: 1px solid var(--linea);
		background: color-mix(in srgb, var(--papel) 55%, var(--papel-alto));
	}

	.detalle {
		padding: var(--e-6) var(--e-8) var(--e-8);
	}

	.resumen-lista {
		margin: 0 var(--e-2) var(--e-2);
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	.filas {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.fila {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr);
		align-items: center;
		gap: var(--e-3);
		padding: var(--e-2);
		border-radius: var(--radio-s);
		color: var(--tinta);
		text-decoration: none;
	}

	.fila-serie {
		grid-template-columns: minmax(0, 1fr);
		padding: var(--e-3);
	}

	.fila:hover {
		background: var(--papel-alto);
	}

	.fila[aria-current='true'] {
		background: var(--papel-alto);
		box-shadow:
			inset 3px 0 0 var(--rubrica),
			var(--sombra-1);
	}

	.fila :global(.miniatura) {
		border-radius: 4px;
	}

	.fila-texto {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.fila-titulo {
		overflow: hidden;
		font-family: var(--letra-interfaz);
		font-weight: 500;
		line-height: 1.25;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.fila-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3em;
		margin: 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	.fila-meta :global(svg) {
		width: 0.95em;
		height: 0.95em;
		flex: none;
	}

	.estado-con_errores {
		color: var(--rubrica);
		font-weight: 700;
	}

	.nueva {
		display: flex;
		margin: 0 var(--e-2) var(--e-3);
	}

	.nueva[aria-current='true'] {
		border-color: var(--tinta);
	}

	.volver {
		display: none;
		margin-bottom: var(--e-4);
		font-family: var(--letra-interfaz);
	}

	.detalle-cabeza {
		display: grid;
		grid-template-columns: minmax(0, 18rem) minmax(0, 1fr);
		align-items: start;
		gap: var(--e-6);
		margin-bottom: var(--e-6);
		font-family: var(--letra-interfaz);
	}

	.detalle-cabeza :global(.poster) {
		border-radius: var(--radio-s);
		box-shadow: var(--sombra-1);
	}

	.detalle h3 {
		margin: 0 0 var(--e-2);
		font-size: var(--t-3);
		outline: none;
	}

	.detalle-cabeza .fila-meta {
		margin-bottom: var(--e-3);
		font-size: var(--t-1);
	}

	.bloque {
		display: grid;
		gap: var(--e-3);
		justify-items: start;
		padding: var(--e-6) 0;
		border-top: 1px solid var(--linea);
	}

	.bloque > * {
		max-width: 100%;
	}

	h4 {
		margin: 0;
		font-family: var(--letra-interfaz);
		font-size: var(--t-1);
		font-weight: 700;
	}

	h4 .nota {
		font-weight: 400;
	}

	.bloque form {
		display: grid;
		gap: var(--e-3);
		justify-items: start;
		width: 100%;
	}

	.fila-youtube {
		display: flex !important;
		flex-wrap: wrap;
		gap: var(--e-2);
		max-width: 40rem;
	}

	.fila-youtube input[type='url'] {
		flex: 1 1 14rem;
		min-width: 0;
	}

	.bloque progress {
		width: min(100%, 24rem);
	}

	.bloque details summary {
		cursor: pointer;
		min-height: 1.5rem;
		font-family: var(--letra-interfaz);
	}

	.antes-despues {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: var(--e-3);
		margin: var(--e-2) 0 0;
	}

	.antes-despues figure {
		margin: 0;
	}

	.antes-despues img {
		width: 100%;
		height: auto;
		border-radius: var(--radio-s);
		background: var(--papel);
	}

	.antes-despues figcaption {
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	.pasos {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.paso-hecho {
		color: var(--tinta);
	}

	.paso-fallido {
		color: var(--rubrica);
		font-weight: 700;
		box-shadow: inset 0 0 0 1px var(--rubrica);
	}

	.detalle-texto {
		margin: 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		max-width: var(--medida);
	}

	/* ── Revisión ── */
	h3 {
		display: flex;
		align-items: center;
		gap: var(--e-2);
		margin: var(--e-6) 0 var(--e-2);
		font-size: var(--t-2);
	}

	.panel-cuerpo > h3:first-child {
		margin-top: var(--e-2);
	}

	.cola {
		display: grid;
		gap: var(--e-3);
		margin: var(--e-4) 0 0;
		padding: 0;
		list-style: none;
	}

	.item {
		max-width: 52rem;
		padding: var(--e-4) var(--e-6);
		border: 1px solid var(--linea);
		border-radius: var(--radio-m);
		background: var(--papel-alto);
	}

	.contexto {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--e-2);
		margin: 0 0 var(--e-2);
		font-family: var(--letra-interfaz);
		font-weight: 500;
	}

	.categoria {
		margin: 0 0 var(--e-2);
		color: var(--suave);
		font-family: var(--letra-interfaz);
	}

	blockquote {
		margin: 0 0 var(--e-4);
		padding-left: var(--e-4);
		border-left: 2px solid var(--pauta);
		font-style: italic;
	}

	.decision {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
	}

	/* ── Piezas comunes ── */
	.nota {
		margin: 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		max-width: var(--medida);
	}

	.vacio {
		display: grid;
		gap: var(--e-2);
		justify-items: center;
		padding: var(--e-12) var(--e-4);
		color: var(--suave);
		font-family: var(--letra-interfaz);
		text-align: center;
	}

	.vacio p {
		margin: 0;
		font-family: var(--letra-texto);
		font-size: var(--t-2);
		font-style: italic;
	}

	label {
		display: block;
		margin: var(--e-4) 0 var(--e-1);
		font-family: var(--letra-interfaz);
	}

	input[type='text'],
	input[type='password'],
	input[type='url'] {
		width: 100%;
	}

	.error {
		margin: 0;
		color: var(--rubrica);
		font-family: var(--letra-interfaz);
	}

	.error::before {
		content: '⚠ ';
	}

	.pista {
		margin: var(--e-1) 0 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	.pista:empty {
		display: none;
	}

	.mensaje {
		font-family: var(--letra-interfaz);
	}

	/* ── Subida ── */
	.subir,
	.nueva-serie {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		max-width: 38rem;
	}

	.subir > button,
	.nueva-serie button {
		justify-self: start;
		margin-top: var(--e-6);
	}

	.nueva-serie textarea {
		width: 100%;
	}

	.zona {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--e-2);
		padding: var(--e-8) var(--e-4);
		border: 1.5px dashed var(--suave);
		border-radius: var(--radio-m);
		background: var(--papel);
		text-align: center;
	}

	.zona.encima {
		border-style: solid;
		border-color: var(--tinta);
		background: var(--papel-alto);
	}

	.zona input {
		justify-self: center;
		max-width: 100%;
		border: 0;
		background: transparent;
	}

	.estado-subida {
		max-width: 38rem;
	}

	.avance {
		display: flex;
		align-items: center;
		gap: var(--e-2);
	}

	progress {
		flex: 1;
		height: 0.6rem;
		accent-color: var(--tinta);
	}

	/* ── Temas y publicadas ── */
	.fusionar {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--e-2) var(--e-4);
	}

	.fusionar select {
		max-width: 100%;
	}

	.etiquetas,
	.publicadas {
		display: grid;
		gap: 0;
		margin: var(--e-2) 0 0;
		padding: 0;
		list-style: none;
		font-family: var(--letra-interfaz);
		max-width: 52rem;
	}

	.etiquetas li,
	.publicadas li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2) var(--e-4);
		min-height: 2.75rem;
		padding: var(--e-2) 0;
		border-bottom: 1px solid var(--linea);
	}

	.etiquetas .nota,
	.publicadas .nota {
		margin-left: auto;
	}

	/*
	 * ── Pantallas medianas: el riel pasa arriba, en una fila ──
	 */
	@media (max-width: 64rem) {
		.app {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
			gap: var(--e-3);
			padding-top: var(--e-4);
		}

		.riel {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			gap: var(--e-2) var(--e-4);
		}

		.riel ul {
			display: flex;
			flex-wrap: wrap;
		}

		.riel nav ul {
			gap: 0;
		}

		.riel nav a {
			min-height: 2.5rem;
			padding: 0 var(--e-2);
			font-size: var(--t-0);
		}

		.gasto-largo {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}

		.pie-riel {
			display: flex;
			align-items: center;
			gap: var(--e-3);
			margin: 0 0 0 auto;
			padding: 0;
			border: 0;
		}

		.gasto .cifra {
			display: inline;
			font-size: var(--t-1);
		}

		.pie-riel button {
			min-height: 2.5rem;
		}

		.detalle {
			padding: var(--e-4) var(--e-6) var(--e-8);
		}

		.detalle-cabeza {
			grid-template-columns: minmax(0, 1fr);
		}

		.detalle-cabeza :global(.poster) {
			max-width: 24rem;
		}
	}

	/*
	 * ── Móvil, pantalla baja o zoom alto: vuelve a ser una página ──
	 * Con poca altura, paneles de alto fijo dejan una rendija para leer (WCAG 1.4.10): aquí la
	 * página se desplaza entera y maestro y detalle se alternan, con «← All videos» para volver.
	 */
	@media (max-width: 48rem), (max-height: 34rem) {
		.app {
			height: auto;
			min-height: calc(100dvh - var(--alto-cabecera));
		}

		.panel,
		.panel-cuerpo,
		.lista,
		.detalle {
			overflow: visible;
		}

		.maestro-detalle {
			grid-template-columns: minmax(0, 1fr);
		}

		.lista {
			border-right: 0;
		}

		.maestro-detalle.con-detalle .lista,
		.maestro-detalle:not(.con-detalle) .detalle {
			display: none;
		}

		.volver {
			display: inline-block;
		}

		.panel-cabeza,
		.panel-cuerpo,
		.detalle {
			padding-inline: var(--e-4);
		}

		.pie-riel {
			flex: 1 1 100%;
			justify-content: space-between;
			margin: 0;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.fila,
		.riel nav a {
			transition: background-color var(--dur-corta) var(--curva);
		}
	}
</style>
