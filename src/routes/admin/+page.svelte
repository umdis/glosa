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
				{#if sensibles.length === 0 && fichas.length === 0 && data.resumenesSerie.length === 0}
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

				{#if data.resumenesSerie.length}
					<h3>Series overviews drafted by AI ({data.resumenesSerie.length})</h3>
					<ul class="cola">
						{#each data.resumenesSerie as r (r.id)}
							<li class="tarjeta">
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
										{#if v.estado === 'listo'}
											<div class="privacidad">
												<p class="detalle" role="status">
													Visual privacy: {v.privacidadVisual
														? 'on. Frames show the audience blurred by SAM 3.1 and clips have no picture.'
														: 'off. Frames and clips show the video as recorded.'}
												</p>
												<form method="post" action="?/privacidad" use:enhance>
													<input type="hidden" name="videoId" value={v.id} />
													<input
														type="hidden"
														name="activa"
														value={v.privacidadVisual ? '0' : '1'}
													/>
													<button type="submit" class="secundario"
														>{v.privacidadVisual ? 'Turn off' : 'Turn on'} visual privacy<span
															class="solo-lector"
														>
															for {v.titulo}</span
														></button
													>
												</form>
												<details>
													<summary>Preview the blur on one frame</summary>
													<p class="detalle">
														The same frame, as recorded and with everyone except the speaker
														blurred. The full video still plays as recorded.
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
											</div>
											{@const s = v.subtitulosEn}
											<form class="subtitulos" method="post" action="?/subtitular" use:enhance>
												<input type="hidden" name="videoId" value={v.id} />
												<p class="detalle" role="status">
													English captions: {s.traducidas} of {s.total} lines{s.enCurso
														? ', translating with Muse Spark… reload to see progress'
														: ''}.
												</p>
												{#if !s.enCurso && s.traducidas < s.total}
													<button type="submit" class="secundario"
														>{s.traducidas
															? 'Translate the missing lines'
															: 'Translate captions to English'}</button
													>
												{/if}
											</form>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section aria-labelledby="t-publicadas">
					<h2 id="t-publicadas">Published investigations</h2>
					<p class="nota">
						Visitors can publish what they write. Unpublishing removes the read link; its author
						cannot publish it again.
					</p>
					{#if data.publicadas.length === 0}
						<p class="nota">None published.</p>
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
				</section>
			</div>
		</div>

		<section class="series" aria-labelledby="t-series">
			<h2 id="t-series">Series</h2>
			<p class="nota">
				Group videos so visitors can watch them in order and ask questions that only those videos
				answer.
			</p>
			<form method="post" action="?/crearSerie" use:enhance class="nueva-serie">
				<label for="nueva-nombre">New series</label>
				<input id="nueva-nombre" name="nombre" type="text" required maxlength="80" />
				<label for="nueva-descripcion">Description (optional)</label>
				<textarea id="nueva-descripcion" name="descripcion" rows="2" maxlength="600"></textarea>
				<button type="submit">Create the series</button>
			</form>

			{#each data.series as s (s.id)}
				<details class="serie tarjeta">
					<summary
						><span lang="es">{s.nombre}</span>
						<span class="nota">{s.videoIds.length} videos</span></summary
					>
					<form method="post" action="?/guardarSerie" use:enhance class="editar-serie">
						<input type="hidden" name="id" value={s.id} />
						<label for="nombre-{s.id}">Name</label>
						<input
							id="nombre-{s.id}"
							name="nombre"
							type="text"
							required
							maxlength="80"
							value={s.nombre}
						/>
						<label for="descripcion-{s.id}">Description</label>
						<textarea id="descripcion-{s.id}" name="descripcion" rows="2" maxlength="600"
							>{s.descripcion}</textarea
						>
						<fieldset>
							<legend>Videos in this series, with their part number</legend>
							<ul class="eleccion">
								{#each data.videos as v (v.id)}
									{@const posicion = s.videoIds.indexOf(v.id)}
									<li>
										<input
											id="v-{s.id}-{v.id}"
											type="checkbox"
											name="video"
											value={v.id}
											checked={posicion >= 0}
										/>
										<label for="v-{s.id}-{v.id}" lang="es">{v.titulo}</label>
										<label class="parte"
											>Part <input
												type="number"
												name="parte-{v.id}"
												min="1"
												max="99"
												value={posicion >= 0 ? posicion + 1 : ''}
											/><span class="solo-lector"> of {v.titulo}</span></label
										>
									</li>
								{/each}
							</ul>
						</fieldset>
						<button type="submit">Save the series</button>
					</form>
					<div class="acciones-serie">
						<form method="post" action="?/resumirSerie" use:enhance>
							<input type="hidden" name="id" value={s.id} />
							<button type="submit" class="secundario"
								>{s.tieneResumen ? 'Draft a new overview' : 'Draft an overview'} with Muse Spark</button
							>
						</form>
						<a href={resolve('/series/[id]', { id: s.id })}>Open the public page</a>
						<form method="post" action="?/borrarSerie" use:enhance>
							<input type="hidden" name="id" value={s.id} />
							<button type="submit" class="secundario"
								>Delete<span class="solo-lector"> the series {s.nombre}</span></button
							>
						</form>
					</div>
				</details>
			{/each}
		</section>

		<section class="temas" aria-labelledby="t-temas">
			<h2 id="t-temas">Topics</h2>
			<p class="nota">
				Topics come from the summaries you approve. Merge two that mean the same: the first one
				disappears and its videos move to the second. A future summary that proposes the merged name
				lands on the second too.
			</p>
			{#if data.etiquetas.length < 2}
				<p class="nota">There are not two topics to merge yet.</p>
			{:else}
				<form method="post" action="?/fusionarEtiquetas" use:enhance class="fusionar">
					<label for="absorbida">Merge</label>
					<select id="absorbida" name="absorbida" required>
						{#each data.etiquetas as e (e.id)}
							<option value={e.id} lang="es">{e.nombre} ({e.usos})</option>
						{/each}
					</select>
					<label for="destino">into</label>
					<select id="destino" name="destino" required>
						{#each data.etiquetas as e (e.id)}
							<option value={e.id} lang="es">{e.nombre} ({e.usos})</option>
						{/each}
					</select>
					<button type="submit">Merge</button>
				</form>
			{/if}
		</section>
	{/if}
</div>

<style>
	.antes-despues {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: var(--e-3);
		margin: var(--e-2) 0 0;
	}

	.antes-despues img {
		width: 100%;
		height: auto;
		border-radius: var(--radio-s, 0.25rem);
		background: var(--papel);
	}

	.antes-despues figcaption {
		color: var(--suave);
		font-size: var(--t-0);
	}

	.privacidad details summary {
		cursor: pointer;
		min-height: 1.5rem;
	}

	.series,
	.temas {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--e-4);
		margin-top: var(--e-12);
	}

	.nueva-serie,
	.editar-serie {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--e-2);
		max-width: 40rem;
	}

	.serie {
		padding: var(--e-4) var(--e-6);
	}

	.serie summary {
		cursor: pointer;
		font-weight: 700;
		min-height: 1.5rem;
	}

	.serie[open] summary {
		margin-bottom: var(--e-4);
	}

	.eleccion {
		display: grid;
		gap: var(--e-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.eleccion li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2);
	}

	.eleccion input[type='checkbox'] {
		width: 1.5rem;
		height: 1.5rem;
	}

	.parte input {
		width: 4.5rem;
	}

	.acciones-serie,
	.fusionar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-3);
		margin-top: var(--e-4);
	}

	.fusionar select {
		max-width: 100%;
	}

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

	.publicadas {
		display: grid;
		gap: var(--e-3);
		margin: var(--e-4) 0 0;
		padding: 0;
		list-style: none;
		font-family: var(--letra-interfaz);
	}

	.publicadas li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2) var(--e-4);
	}

	.publicadas .nota {
		margin: 0;
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
		/* Sin esto, la pista toma el ancho mínimo del contenido y la página desborda a 390 px. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--e-12);
		margin-top: var(--e-8);
	}

	.lateral {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
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
		/* El selector de archivo tiene ancho propio: sin esto empuja la página a 390 px. */
		grid-template-columns: minmax(0, 1fr);
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
