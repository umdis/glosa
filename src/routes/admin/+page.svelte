<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Fotograma from '#lib/componentes/Fotograma.svelte';
	import { duracion, folio } from '#lib/formato.js';
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
	const CATEGORIA: Record<string, string> = {
		salud: 'Health of a private person',
		fallecimiento: 'Death or mourning',
		menores: 'A minor',
		persona_privada: 'Private matter'
	};

	let titulo = $state('');
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
		peticion.open('POST', `/api/videos?titulo=${encodeURIComponent(titulo.trim())}`);
		peticion.setRequestHeader('Content-Type', 'application/octet-stream');
		peticion.upload.onprogress = (e) => {
			if (e.lengthComputable) progreso = Math.round((e.loaded / e.total) * 100);
		};
		peticion.onload = () => {
			progreso = null;
			if (peticion.status === 202) {
				mensajeSubida = `Uploaded “${titulo.trim()}”. It is being processed; this page updates when you reload it.`;
				titulo = '';
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

	const sensibles = $derived(
		data.autenticado ? data.pendientes.filter((p) => p.tipo === 'fragmento_sensible') : []
	);
	const fichas = $derived(
		data.autenticado ? data.pendientes.filter((p) => p.tipo !== 'fragmento_sensible') : []
	);
</script>

<svelte:head>
	<title>Editor — Glosa</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet icono(estado: string)}
	<svg viewBox="0 0 16 16" aria-hidden="true">
		{#if estado === 'hecho'}
			<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4" /><path
				d="M5 8.2l2 2 4-4.4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		{:else if estado === 'fallido'}
			<path
				d="M8 1.8L15 14H1z M8 6v4 M8 11.6v.4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		{:else if estado === 'en_curso'}
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

<div class="pagina" class:acceso={!data.autenticado}>
	{#if !data.autenticado}
		<div class="entrada tarjeta">
			<h1>Editor</h1>
			{#if !data.configurado}
				<p class="nota">The editor is disabled: this server has no ADMIN_TOKEN configured.</p>
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
						aria-describedby={form && 'error' in form ? 'error-clave' : undefined}
					/>
					{#if form && 'error' in form}<p id="error-clave" class="error">{form.error}</p>{/if}
					<button type="submit">Sign in</button>
				</form>
			{/if}
		</div>
	{:else}
		<header class="barra">
			<h1>Editor</h1>
			<p class="gasto" class:alcanzado={data.topeAlcanzado}>
				Spent on AI today: US${data.gastoHoy.toFixed(2)}{#if data.topeAlcanzado}. The daily limit is
					reached: visitors cannot ask questions until tomorrow{/if}.
			</p>
			<form method="post" action="?/salir" use:enhance>
				<button type="submit" class="secundario">Sign out</button>
			</form>
		</header>

		{#if form && 'error' in form}<p class="error" role="alert">{form.error}</p>{/if}

		<div class="columnas">
			<section class="revisar" aria-labelledby="t-revisar">
				<h2 id="t-revisar">To review</h2>
				{#if sensibles.length === 0 && fichas.length === 0}
					<p class="nota">Nothing waits for a decision.</p>
				{/if}

				{#if sensibles.length}
					<h3>Private information about other people ({sensibles.length})</h3>
					<p class="nota">
						These passages are hidden from the public. Publish one only if the people it mentions
						would agree.
					</p>
					<ul class="cola">
						{#each sensibles as p (p.id)}
							<li class="tarjeta">
								<p class="contexto">
									<span lang="es"
										>{p.titulo}{#if p.inicioMs !== null},{/if}</span
									>
									{#if p.inicioMs !== null}<span class="folio">¶ {folio(p.inicioMs)}</span>{/if}
								</p>
								<p class="categoria">
									<span class="insignia">{CATEGORIA[p.categoria ?? ''] ?? p.categoria}</span>
									<span lang="es">{p.contenido}</span>
								</p>
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
					<h3>Summaries and topics drafted by AI ({fichas.length})</h3>
					<ul class="cola">
						{#each fichas as p (p.id)}
							<li class="tarjeta">
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
			</section>

			<div class="lateral">
				<section aria-labelledby="t-subir">
					<h2 id="t-subir">Add a video</h2>
					<p class="nota">
						Only upload videos you have permission to publish. Glosa transcribes them, hides
						anything that looks like private information about other people, and drafts a summary
						for you to review.
					</p>
					<form onsubmit={subir} class="subir">
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
					<div role="status" aria-live="polite">
						{#if progreso !== null}
							<label class="avance"
								>Uploading <progress max="100" value={progreso}>{progreso}%</progress>
								{progreso}%</label
							>
						{/if}
						{#if mensajeSubida}<p class="mensaje">{mensajeSubida}</p>{/if}
					</div>
				</section>

				<section aria-labelledby="t-videos">
					<h2 id="t-videos">Videos</h2>
					{#if data.videos.length === 0}
						<p class="nota">No videos yet.</p>
					{:else}
						<ul class="videos">
							{#each data.videos as v (v.id)}
								<li>
									<Fotograma videoId={v.id} segundo={v.posterSegundo} clase="miniatura" />
									<div class="datos">
										<p class="titulo-video">
											<a href={resolve('/videos/[id]', { id: v.id })} lang="es">{v.titulo}</a>
											{#if v.duracionMs}<span class="nota">{duracion(v.duracionMs)}</span>{/if}
										</p>
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
											<p class="detalle">{NOMBRES_PASO[paso.paso] ?? paso.paso}: {paso.error}</p>
										{/each}
										{#if v.estado === 'con_errores'}
											<form method="post" action="?/reintentar" use:enhance>
												<input type="hidden" name="videoId" value={v.id} />
												<button type="submit" class="secundario">Retry the failed steps</button>
											</form>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>
		</div>
	{/if}
</div>

<style>
	.pagina {
		max-width: 76rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) var(--e-16);
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
	}

	h2 {
		margin-bottom: var(--e-3);
		font-size: var(--t-3);
		font-style: italic;
	}

	h3 {
		margin: var(--e-8) 0 var(--e-2);
		font-size: var(--t-2);
	}

	.nota {
		color: var(--suave);
		font-family: var(--letra-interfaz);
		max-width: var(--medida);
		margin: var(--e-2) 0 0;
	}

	label {
		display: block;
		margin: var(--e-4) 0 var(--e-1);
		font-family: var(--letra-interfaz);
	}

	input[type='text'],
	input[type='password'] {
		width: 100%;
	}

	.error {
		font-family: var(--letra-interfaz);
	}

	.error::before {
		content: '⚠ ';
	}

	/* ── Acceso: una sola pieza centrada ── */
	.acceso {
		display: grid;
		place-items: center;
		min-height: calc(100vh - var(--alto-cabecera) - var(--e-16));
	}

	.entrada {
		width: min(100%, 26rem);
		padding: var(--e-8);
	}

	.entrada button {
		width: 100%;
		margin-top: var(--e-6);
	}

	/* ── Barra ── */
	.barra {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-3) var(--e-6);
		padding-bottom: var(--e-6);
		border-bottom: 1px solid var(--linea);
	}

	.gasto {
		flex: 1;
		margin: 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
	}

	.gasto.alcanzado {
		color: var(--tinta);
		font-weight: 500;
	}

	.columnas {
		display: grid;
		gap: var(--e-12);
		margin-top: var(--e-8);
	}

	.lateral {
		display: grid;
		gap: var(--e-12);
		align-content: start;
	}

	/* ── Cola de revisión ── */
	.cola {
		display: grid;
		gap: var(--e-3);
		margin: var(--e-4) 0 0;
		padding: 0;
		list-style: none;
	}

	.cola > li {
		padding: var(--e-4) var(--e-6);
	}

	.contexto,
	.categoria {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--e-2);
		margin: 0 0 var(--e-2);
		font-family: var(--letra-interfaz);
	}

	.categoria {
		color: var(--suave);
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

	/* ── Subida ── */
	.zona {
		display: grid;
		gap: var(--e-2);
		padding: var(--e-6) var(--e-4);
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

	.pista {
		margin: 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	.subir button {
		margin-top: var(--e-4);
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

	.mensaje {
		font-family: var(--letra-interfaz);
	}

	/* ── Videos ── */
	.videos {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.videos > li {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr);
		gap: var(--e-4);
		padding: var(--e-4) 0;
		border-top: 1px solid var(--linea);
	}

	.videos :global(.miniatura) {
		border-radius: var(--radio-s);
	}

	.titulo-video {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--e-1) var(--e-3);
		margin: 0 0 var(--e-2);
	}

	.titulo-video .nota {
		margin: 0;
	}

	.pasos {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-1);
		margin: 0 0 var(--e-2);
		padding: 0;
		list-style: none;
	}

	.paso-hecho {
		color: var(--tinta);
	}

	.paso-fallido {
		color: var(--tinta);
		font-weight: 700;
		box-shadow: inset 0 0 0 1px var(--tinta);
	}

	.detalle {
		margin: 0 0 var(--e-2);
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	@media (min-width: 64rem) {
		.columnas {
			grid-template-columns: minmax(0, 1fr) 24rem;
		}
	}
</style>
