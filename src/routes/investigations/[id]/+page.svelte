<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { folio } from '#lib/formato.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const inv = $derived(data.investigacion);
	const enlaceCita = (videoId: string, inicioMs: number, fragmentoId: number) =>
		resolve(`/videos/[id]?t=${Math.floor(inicioMs / 1000)}#f-${fragmentoId}`, { id: videoId });

	let redactando = $state(false);
	let copiado = $state('');
	let tipoNuevo = $state<'texto' | 'titulo' | 'nota'>('texto');

	/** Tras mover, editar o añadir, el foco sigue al bloque (y al mismo botón si se movió). */
	$effect(() => {
		const destino = form && 'enfocar' in form ? form.enfocar : undefined;
		const direccion = form && 'direccion' in form ? form.direccion : undefined;
		if (!destino) return;
		tick().then(() => {
			const bloque = document.getElementById(`b-${destino}`);
			const boton = direccion
				? bloque?.querySelector<HTMLButtonElement>(`[data-mover="${direccion}"]:not([disabled])`)
				: null;
			(boton ?? bloque)?.focus();
		});
	});

	async function copiar(texto: string, que: string) {
		try {
			await navigator.clipboard.writeText(texto);
			copiado = `${que} copied.`;
		} catch {
			copiado = `Select the ${que.toLowerCase()} and copy it.`;
		}
	}

	const etiquetaTipo = { titulo: 'Heading', texto: 'Paragraph', nota: 'Note', cita: 'Quote' };
</script>

<svelte:head>
	<title>{inv.titulo} — Glosa</title>
	<meta name="robots" content="noindex" />
	<meta property="og:title" content={inv.titulo} />
	<meta
		property="og:description"
		content="A study with verified quotes from video, made with Glosa."
	/>
</svelte:head>

<article class="investigacion">
	<header class="encabezado">
		<p class="sobre">
			{#if data.editable}
				<span class="insignia">{inv.publicada ? 'Published' : 'Private'}</span>
			{:else}
				Investigation
			{/if}
		</p>
		<h1>{inv.titulo}</h1>
	</header>

	<div class="estado" role="status" aria-live="polite">
		{#if form && 'aviso' in form && form.aviso}<p class="aviso">{form.aviso}</p>{/if}
		{#if copiado}<p class="aviso">{copiado}</p>{/if}
	</div>
	{#if form && 'error' in form && form.error}
		<p class="error" role="alert">{form.error}</p>
	{/if}

	{#if data.nueva && data.enlaceEdicion}
		<section class="bienvenida tarjeta" aria-labelledby="t-bienvenida">
			<h2 id="t-bienvenida">Keep your edit link</h2>
			<p>
				There is no account: this browser remembers the investigation, and this private link opens
				it for editing anywhere. Whoever has it can edit, so share the read link instead.
			</p>
			<div class="enlace">
				<label class="solo-lector" for="enlace-bienvenida">Private edit link</label>
				<input id="enlace-bienvenida" type="text" readonly value={data.enlaceEdicion} />
				<button
					type="button"
					class="secundario"
					onclick={() => copiar(data.enlaceEdicion!, 'Edit link')}>Copy</button
				>
			</div>
		</section>
	{/if}

	<!-- ── Los bloques ── -->
	{#if data.bloques.length === 0}
		<p class="vacio">
			{#if data.editable}
				Empty for now. Save quotes with <strong>Save to investigation</strong> in
				<a href={resolve('/ask')}>Ask</a>, <a href={resolve('/search')}>Search</a> or any video, or write
				a block below.
			{:else}
				This investigation is empty.
			{/if}
		</p>
	{:else}
		<h2 class="solo-lector" id="t-bloques">Contents</h2>
		<ol class="bloques" aria-labelledby="t-bloques">
			{#each data.bloques as b, i (b.id)}
				<li id="b-{b.id}" class="bloque {b.tipo}" tabindex="-1">
					{#if b.tipo === 'cita'}
						{#if b.cita}
							<figure class="glosa">
								<blockquote lang="es">«{b.cita.frase}»</blockquote>
								<figcaption class="fuente">
									<a
										class="folio"
										href={enlaceCita(b.cita.videoId, b.cita.inicioMs, b.cita.fragmentoId)}
										><span lang="es">{b.cita.titulo}</span>, ¶ {folio(b.cita.inicioMs)}</a
									>
								</figcaption>
							</figure>
						{:else}
							<p class="retirada">
								Quote withdrawn: the editor of the collection hid this passage after it was saved.
							</p>
						{/if}
					{:else if b.tipo === 'titulo'}
						<h2>{b.texto}</h2>
					{:else if b.tipo === 'nota'}
						<aside class="nota-bloque" aria-label="Note">
							{#each b.texto.split(/\n{2,}/) as p, j (j)}<p>{p}</p>{/each}
						</aside>
					{:else}
						{#each b.texto.split(/\n{2,}/) as p, j (j)}<p>{p}</p>{/each}
					{/if}

					{#if b.origenIa}
						<p class="ia"><span class="insignia">Drafted by Muse Spark</span></p>
					{/if}

					{#if data.editable}
						<div class="controles">
							<form method="post" action="?/mover" use:enhance>
								<input type="hidden" name="bloque" value={b.id} />
								<input type="hidden" name="direccion" value="arriba" />
								<button
									type="submit"
									class="fantasma"
									data-mover="arriba"
									disabled={i === 0}
									aria-label="Move {etiquetaTipo[b.tipo].toLowerCase()} {i + 1} up">Up</button
								>
							</form>
							<form method="post" action="?/mover" use:enhance>
								<input type="hidden" name="bloque" value={b.id} />
								<input type="hidden" name="direccion" value="abajo" />
								<button
									type="submit"
									class="fantasma"
									data-mover="abajo"
									disabled={i === data.bloques.length - 1}
									aria-label="Move {etiquetaTipo[b.tipo].toLowerCase()} {i + 1} down">Down</button
								>
							</form>
							{#if b.tipo !== 'cita'}
								<details class="editar">
									<summary
										>Edit<span class="solo-lector">
											{etiquetaTipo[b.tipo].toLowerCase()} {i + 1}</span
										></summary
									>
									<form
										method="post"
										action="?/editar"
										use:enhance={() =>
											async ({ update }) =>
												update({ reset: false })}
									>
										<input type="hidden" name="bloque" value={b.id} />
										<label for="editar-{b.id}">{etiquetaTipo[b.tipo]} text</label>
										{#if b.tipo === 'titulo'}
											<input
												id="editar-{b.id}"
												name="texto"
												type="text"
												maxlength="120"
												value={b.texto}
												required
											/>
										{:else}
											<textarea id="editar-{b.id}" name="texto" rows="5" maxlength="4000" required
												>{b.texto}</textarea
											>
										{/if}
										<button type="submit">Save</button>
									</form>
								</details>
							{/if}
							<form method="post" action="?/borrar" use:enhance>
								<input type="hidden" name="bloque" value={b.id} />
								<button
									type="submit"
									class="fantasma"
									aria-label="Delete {etiquetaTipo[b.tipo].toLowerCase()} {i + 1}">Delete</button
								>
							</form>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	{#if data.editable}
		<!-- ── Escribir ── -->
		<section class="tarjeta panel" aria-labelledby="t-escribir">
			<h2 id="t-escribir">Write a block</h2>
			<form method="post" action="?/anadir" use:enhance>
				<fieldset>
					<legend>Kind of block</legend>
					<div class="tipos">
						{#each [['texto', 'Paragraph'], ['titulo', 'Heading'], ['nota', 'Note to yourself']] as [valor, nombre] (valor)}
							<label class="tipo"
								><input type="radio" name="tipo" value={valor} bind:group={tipoNuevo} />
								{nombre}</label
							>
						{/each}
					</div>
				</fieldset>
				<label for="texto-nuevo">Text</label>
				{#if tipoNuevo === 'titulo'}
					<input id="texto-nuevo" name="texto" type="text" maxlength="120" required />
				{:else}
					<textarea id="texto-nuevo" name="texto" rows="4" maxlength="4000" required></textarea>
				{/if}
				<button type="submit">Add at the end</button>
			</form>
		</section>

		<section class="tarjeta panel" aria-labelledby="t-redactar">
			<h2 id="t-redactar">Draft with Muse Spark</h2>
			<p class="explica">
				Spark writes a section using only the quotes in this investigation. Every quote it uses is
				checked against the transcript; anything that does not match is left out. The draft is added
				at the end, marked, and you can edit or delete it.
			</p>
			{#if data.redaccionDisponible}
				<form
					method="post"
					action="?/redactar"
					use:enhance={() => {
						redactando = true;
						return async ({ update }) => {
							await update();
							redactando = false;
						};
					}}
				>
					<label for="pedido">What should the section do? (optional)</label>
					<input
						id="pedido"
						name="pedido"
						type="text"
						maxlength="200"
						placeholder="For example: an introduction for a small group"
					/>
					<button type="submit" disabled={redactando}
						>{redactando ? 'Drafting… about 20 seconds' : 'Draft a section'}</button
					>
				</form>
			{:else}
				<p class="explica">
					Drafting is paused: this demo reached its daily AI limit. Writing, saving and exporting
					still work.
				</p>
			{/if}
		</section>
	{/if}

	<!-- ── Compartir y exportar ── -->
	<section class="tarjeta panel" aria-labelledby="t-compartir">
		<h2 id="t-compartir">{data.editable ? 'Share and export' : 'Export'}</h2>
		<div class="exportar">
			<a
				class="boton secundario"
				href={resolve('/investigations/[id]/export/[formato]', { id: inv.id, formato: 'docx' })}
				download>Word (.docx)</a
			>
			<a
				class="boton secundario"
				href={resolve('/investigations/[id]/export/[formato]', { id: inv.id, formato: 'md' })}
				download>Markdown</a
			>
			<button type="button" class="secundario" onclick={() => window.print()}
				>Print or save as PDF</button
			>
		</div>

		{#if data.editable}
			<form method="post" action="?/publicar" use:enhance class="publicar">
				<input type="hidden" name="publicada" value={inv.publicada ? '0' : '1'} />
				<p>
					{#if inv.publicada}
						Published: anyone with the read link can see it, but not edit it.
					{:else if inv.retirada}
						The editor of this collection unpublished it.
					{:else}
						Private: only people with the edit link can see it.
					{/if}
				</p>
				{#if !inv.retirada}
					<button type="submit" class="secundario">{inv.publicada ? 'Unpublish' : 'Publish'}</button
					>
				{/if}
			</form>

			{#if inv.publicada}
				<div class="enlace">
					<label for="enlace-lectura">Read link (safe to share)</label>
					<input id="enlace-lectura" type="text" readonly value={data.enlaceLectura} />
					<button
						type="button"
						class="secundario"
						onclick={() => copiar(data.enlaceLectura, 'Read link')}>Copy</button
					>
				</div>
			{/if}
			{#if data.enlaceEdicion}
				<div class="enlace">
					<label for="enlace-edicion">Private edit link (whoever has it can edit)</label>
					<input id="enlace-edicion" type="text" readonly value={data.enlaceEdicion} />
					<button
						type="button"
						class="secundario"
						onclick={() => copiar(data.enlaceEdicion!, 'Edit link')}>Copy</button
					>
				</div>
			{/if}

			<details class="mas">
				<summary>Rename or forget</summary>
				<form
					method="post"
					action="?/renombrar"
					use:enhance={() =>
						async ({ update }) =>
							update({ reset: false })}
				>
					<label for="renombrar">Title</label>
					<div class="fila">
						<input
							id="renombrar"
							name="titulo"
							type="text"
							maxlength="120"
							value={inv.titulo}
							required
						/>
						<button type="submit" class="secundario">Rename</button>
					</div>
				</form>
				<form method="post" action="?/olvidar">
					<p class="explica">
						Forgetting removes it from this browser only. It is not deleted: the edit link still
						opens it.
					</p>
					<button type="submit" class="secundario">Forget on this browser</button>
				</form>
			</details>
		{/if}
	</section>

	<p class="pie">Every quote was checked against the video transcript with Glosa.</p>
</article>

<style>
	.investigacion {
		max-width: 46rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) 5rem;
	}

	.sobre {
		margin: 0 0 var(--e-2);
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	h1 {
		font-size: var(--t-5);
		font-style: italic;
		line-height: 1.1;
		margin: 0 0 var(--e-8);
	}

	h2 {
		font-size: var(--t-3);
		font-style: italic;
	}

	.aviso,
	.error {
		font-family: var(--letra-interfaz);
		max-width: var(--medida);
	}

	.aviso {
		border-left: 2px solid var(--rubrica);
		padding-left: var(--e-3);
	}

	.vacio,
	.retirada,
	.explica,
	.pie {
		color: var(--suave);
	}

	.explica {
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
		max-width: var(--medida);
	}

	.bienvenida,
	.panel {
		padding: var(--e-6);
		margin: var(--e-8) 0;
		font-family: var(--letra-interfaz);
	}

	.bienvenida h2,
	.panel h2 {
		margin-top: 0;
	}

	/* ── Bloques: el texto manda; los controles, discretos debajo. ── */
	.bloques {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.bloque {
		position: relative;
		padding: var(--e-3) 0 var(--e-2);
		border-radius: var(--radio-s);
		scroll-margin-top: calc(var(--alto-cabecera) + var(--e-4));
	}

	.bloque:focus-visible {
		outline: 2px solid var(--marca);
		outline-offset: 4px;
	}

	.bloque p {
		margin: 0 0 var(--e-3);
		font-size: var(--t-2);
		line-height: 1.55;
	}

	.bloque.titulo h2 {
		margin: var(--e-6) 0 var(--e-2);
	}

	.nota-bloque {
		padding: var(--e-3) var(--e-4);
		border-left: 2px dashed var(--suave);
		color: var(--suave);
	}

	.nota-bloque p {
		font-size: var(--t-1);
	}

	figure {
		margin: var(--e-2) 0 var(--e-4);
	}

	blockquote {
		margin: 0;
		font-family: var(--letra-texto);
		font-size: var(--t-2);
		font-style: italic;
		line-height: 1.5;
	}

	.fuente {
		margin-top: var(--e-2);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	.ia {
		margin: 0 0 var(--e-2);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	.controles {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		gap: var(--e-1);
		font-family: var(--letra-interfaz);
	}

	.controles button,
	.controles summary {
		min-height: 2.25rem;
		padding: 0 0.7rem;
		font-size: var(--t-0);
		color: var(--suave);
	}

	.controles summary {
		display: inline-flex;
		align-items: center;
		border-radius: var(--radio-s);
		cursor: pointer;
	}

	.editar[open] {
		flex-basis: 100%;
		order: 5;
	}

	.editar form {
		display: grid;
		gap: var(--e-2);
		margin: var(--e-2) 0 var(--e-4);
	}

	.editar textarea,
	.editar input {
		width: 100%;
	}

	/* ── Formularios de los paneles ── */
	.panel form {
		display: grid;
		gap: var(--e-2);
		justify-items: start;
	}

	.panel textarea,
	.panel input[type='text'] {
		width: 100%;
	}

	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}

	legend {
		margin-bottom: var(--e-2);
	}

	.tipos {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2) var(--e-4);
	}

	.tipo {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.75rem;
	}

	.exportar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
	}

	.publicar {
		margin-top: var(--e-6);
	}

	.publicar p {
		margin: 0;
	}

	.enlace {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2);
		margin-top: var(--e-4);
	}

	.enlace label {
		flex-basis: 100%;
	}

	.enlace input {
		flex: 1 1 14rem;
		min-width: 0;
		font-size: var(--t-0);
	}

	.mas {
		margin-top: var(--e-6);
	}

	.mas summary {
		cursor: pointer;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
	}

	.mas form {
		margin-top: var(--e-4);
	}

	.fila {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
		width: 100%;
	}

	.fila input {
		flex: 1 1 14rem;
		min-width: 0;
	}

	.pie {
		margin-top: var(--e-12);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
		font-style: italic;
	}

	/* Al imprimir: solo el estudio, sin la interfaz alrededor. */
	@media print {
		:global(.cabecera),
		:global(.saltar),
		.controles,
		.panel,
		.bienvenida,
		.estado,
		.ia,
		.sobre {
			display: none !important;
		}
		.investigacion {
			max-width: none;
			padding: 0;
		}
		.bloque {
			break-inside: avoid;
		}
	}
</style>
