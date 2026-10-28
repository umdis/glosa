<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { duracion, folio } from '#lib/formato.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const NOMBRES_PASO: Record<string, string> = {
		normalizar: 'Prepare video',
		transcribir: 'Transcribe',
		sensibles: 'Check sensitive passages',
		ficha: 'Draft summary'
	};
	const CATEGORIA: Record<string, string> = {
		salud: 'Health of a private person',
		fallecimiento: 'Death or mourning',
		menores: 'A minor',
		persona_privada: 'Private matter'
	};

	let titulo = $state('');
	let archivo = $state<FileList>();
	let progreso = $state<number | null>(null);
	let mensajeSubida = $state('');

	/** Sube con XMLHttpRequest para poder mostrar el avance: un video pesa cientos de MB. */
	function subir(evento: SubmitEvent) {
		evento.preventDefault();
		const elegido = archivo?.[0];
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

<div class="pagina">
	<h1>Editor</h1>

	{#if !data.autenticado}
		{#if !data.configurado}
			<p class="nota">The editor is disabled: this server has no ADMIN_TOKEN configured.</p>
		{:else}
			<form method="post" action="?/entrar" use:enhance class="entrar">
				<label for="clave">Editor key</label>
				<div class="fila">
					<input
						id="clave"
						name="clave"
						type="password"
						autocomplete="current-password"
						required
						aria-describedby={form && 'error' in form ? 'error-clave' : undefined}
					/>
					<button type="submit">Sign in</button>
				</div>
				{#if form && 'error' in form}<p id="error-clave" class="error">{form.error}</p>{/if}
			</form>
		{/if}
	{:else}
		<form method="post" action="?/salir" use:enhance class="salir">
			<p class="nota">
				Spent on AI today: US${data.gastoHoy.toFixed(2)}{#if data.topeAlcanzado}. The daily limit is
					reached: visitors cannot ask questions until tomorrow{/if}.
			</p>
			<button type="submit" class="secundario">Sign out</button>
		</form>

		{#if form && 'error' in form}<p class="error" role="alert">{form.error}</p>{/if}

		<section aria-labelledby="t-subir">
			<h2 id="t-subir">Add a video</h2>
			<p class="nota">
				Only upload videos you have permission to publish. Glosa transcribes them, hides anything
				that looks like private information about other people, and drafts a summary for you to
				review below.
			</p>
			<form onsubmit={subir} class="subir">
				<label for="titulo">Title</label>
				<input id="titulo" type="text" bind:value={titulo} required maxlength="200" />
				<label for="archivo">Video file (mp4)</label>
				<input id="archivo" type="file" accept="video/*" bind:files={archivo} required />
				<button type="submit" disabled={progreso !== null}>Upload</button>
			</form>
			<div role="status" aria-live="polite">
				{#if progreso !== null}
					<label class="avance"
						>Uploading <progress max="100" value={progreso}>{progreso}%</progress>
						{progreso}%</label
					>
				{/if}
				{#if mensajeSubida}<p>{mensajeSubida}</p>{/if}
			</div>
		</section>

		<section aria-labelledby="t-revisar">
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
						<li>
							<p class="contexto">
								{p.titulo}{#if p.inicioMs !== null}, <span class="folio">¶ {folio(p.inicioMs)}</span
									>{/if}
								<span class="categoria"
									>{CATEGORIA[p.categoria ?? ''] ?? p.categoria}: {p.contenido}</span
								>
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
						<li>
							<p class="contexto">{p.titulo}, {p.tipo === 'resumen' ? 'summary' : 'topics'}</p>
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

		<section aria-labelledby="t-videos">
			<h2 id="t-videos">Videos</h2>
			{#if data.videos.length === 0}
				<p class="nota">No videos yet.</p>
			{:else}
				<ul class="videos">
					{#each data.videos as v (v.id)}
						<li>
							<p class="titulo-video">
								<a href={resolve('/videos/[id]', { id: v.id })}>{v.titulo}</a>
								{#if v.duracionMs}<span class="nota">{duracion(v.duracionMs)}</span>{/if}
							</p>
							<ol class="pasos">
								{#each v.pasos as paso (paso.paso)}
									<li class="paso-{paso.estado}">
										{NOMBRES_PASO[paso.paso] ?? paso.paso}:
										{{
											pendiente: 'waiting',
											en_curso: 'in progress',
											hecho: 'done',
											fallido: 'failed'
										}[paso.estado] ?? paso.estado}{#if paso.error}
											<span class="detalle">({paso.error})</span>{/if}
									</li>
								{/each}
							</ol>
							{#if v.estado === 'con_errores'}
								<form method="post" action="?/reintentar" use:enhance>
									<input type="hidden" name="videoId" value={v.id} />
									<button type="submit" class="secundario">Retry the failed steps</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<style>
	.pagina {
		max-width: 48rem;
		margin: 0 auto;
		padding: 2.5rem var(--margen) 5rem;
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
	}

	h2 {
		font-size: var(--t-3);
		margin: 3rem 0 0.75rem;
	}

	h3 {
		font-size: var(--t-2);
		margin: 2rem 0 0.5rem;
	}

	.nota {
		color: var(--suave);
		font-family: var(--letra-interfaz);
		max-width: var(--medida);
	}

	label {
		display: block;
		font-family: var(--letra-interfaz);
		margin: 0.75rem 0 0.3rem;
	}

	.fila {
		display: flex;
		gap: 0.5rem;
	}

	input[type='text'],
	input[type='password'] {
		font-family: var(--letra-interfaz);
		font-size: var(--t-1);
		background: var(--papel);
		color: var(--tinta);
		border: 1px solid var(--suave);
		border-radius: 3px;
		padding: 0.4rem 0.7rem;
		min-height: 2.75rem;
		width: 100%;
	}

	.fila input {
		flex: 1;
		min-width: 0;
	}

	input[type='file'] {
		font-family: var(--letra-interfaz);
		min-height: 2.75rem;
	}

	.subir button {
		margin-top: 1rem;
	}

	.salir {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}

	:global(button.secundario) {
		background: transparent;
		color: var(--tinta);
	}

	.error {
		font-family: var(--letra-interfaz);
	}

	.error::before {
		content: '⚠ ';
	}

	.avance {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.cola,
	.videos {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.cola > li,
	.videos > li {
		padding: 1rem 0;
		border-bottom: 1px solid var(--pauta);
	}

	.contexto {
		font-family: var(--letra-interfaz);
		margin: 0 0 0.4rem;
	}

	.categoria {
		display: block;
		color: var(--suave);
	}

	blockquote {
		margin: 0 0 0.75rem;
		padding-left: 1rem;
		border-left: 2px solid var(--suave);
		font-style: italic;
	}

	.decision {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.titulo-video {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		align-items: baseline;
		margin: 0 0 0.4rem;
		font-size: var(--t-1);
	}

	.pasos {
		font-family: var(--letra-interfaz);
		margin: 0 0 0.5rem;
		padding-left: 1.2rem;
	}

	.paso-fallido {
		font-weight: 700;
	}

	.detalle {
		color: var(--suave);
		font-weight: 400;
	}
</style>
