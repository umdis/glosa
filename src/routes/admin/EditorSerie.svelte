<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	interface VideoBreve {
		id: string;
		titulo: string;
	}

	interface Props {
		serie: {
			id: string;
			nombre: string;
			descripcion: string;
			videoIds: string[];
			tieneResumen: boolean;
		};
		videos: VideoBreve[];
	}

	let { serie, videos }: Props = $props();

	/*
	 * Solo se pintan los videos de la serie y, al buscar, unas pocas coincidencias para añadir:
	 * con 400 videos, una casilla por video y por serie dejaba miles de controles en la página.
	 * El orden de la lista es el de las partes; se cambia con «Up»/«Down», sin arrastrar.
	 */
	// El editor se recrea con {#key} al cambiar de serie: tomar el valor inicial es lo buscado.
	// svelte-ignore state_referenced_locally
	let elegidos = $state([...serie.videoIds]);
	let busqueda = $state('');
	let confirmarBorrado = $state(false);
	let aviso = $state('');

	const porId = $derived(new Map(videos.map((v) => [v.id, v])));
	const normalizar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
	const MAX_RESULTADOS = 12;
	const candidatos = $derived.by(() => {
		const q = normalizar(busqueda.trim());
		if (!q) return [];
		return videos
			.filter((v) => !elegidos.includes(v.id) && normalizar(v.titulo).includes(q))
			.slice(0, MAX_RESULTADOS);
	});

	function anadir(v: VideoBreve) {
		elegidos = [...elegidos, v.id];
		aviso = `Added “${v.titulo}” as part ${elegidos.length}. Save the series to keep it.`;
	}

	function quitar(id: string) {
		elegidos = elegidos.filter((x) => x !== id);
		aviso = `Removed “${porId.get(id)?.titulo ?? ''}”. Save the series to keep it.`;
	}

	function mover(indice: number, paso: -1 | 1) {
		const destino = indice + paso;
		if (destino < 0 || destino >= elegidos.length) return;
		const copia = [...elegidos];
		[copia[indice], copia[destino]] = [copia[destino], copia[indice]];
		elegidos = copia;
		aviso = `“${porId.get(copia[destino])?.titulo ?? ''}” is now part ${destino + 1}.`;
	}
</script>

<div class="editor">
	<form
		method="post"
		action="?/guardarSerie"
		class="campos"
		use:enhance={() =>
			async ({ update }) => {
				await update({ reset: false });
				aviso = 'Series saved.';
			}}
	>
		<input type="hidden" name="id" value={serie.id} />
		{#each elegidos as id, i (id)}
			<input type="hidden" name="video" value={id} />
			<input type="hidden" name="parte-{id}" value={i + 1} />
		{/each}

		<div class="fila-campos">
			<div>
				<label for="nombre-{serie.id}">Name</label>
				<input
					id="nombre-{serie.id}"
					name="nombre"
					type="text"
					required
					maxlength="80"
					value={serie.nombre}
				/>
			</div>
			<div>
				<label for="descripcion-{serie.id}">Description</label>
				<textarea id="descripcion-{serie.id}" name="descripcion" rows="2" maxlength="600"
					>{serie.descripcion}</textarea
				>
			</div>
		</div>

		<h4 id="partes-{serie.id}">Videos in order ({elegidos.length})</h4>
		{#if elegidos.length === 0}
			<p class="nota">No videos yet. Find one below to add it.</p>
		{:else}
			<ol class="partes" aria-labelledby="partes-{serie.id}">
				{#each elegidos as id, i (id)}
					{@const v = porId.get(id)}
					<li>
						<span class="numero" aria-hidden="true">{i + 1}</span>
						<span class="nombre" lang="es">{v?.titulo ?? 'Deleted video'}</span>
						<span class="mover">
							<button type="button" class="fantasma" disabled={i === 0} onclick={() => mover(i, -1)}
								><span aria-hidden="true">↑</span> Up<span class="solo-lector">: {v?.titulo}</span
								></button
							>
							<button
								type="button"
								class="fantasma"
								disabled={i === elegidos.length - 1}
								onclick={() => mover(i, 1)}
								><span aria-hidden="true">↓</span> Down<span class="solo-lector">: {v?.titulo}</span
								></button
							>
							<button type="button" class="secundario" onclick={() => quitar(id)}
								>Remove<span class="solo-lector"> {v?.titulo}</span></button
							>
						</span>
					</li>
				{/each}
			</ol>
		{/if}

		<label for="buscar-{serie.id}">Add a video</label>
		<input
			id="buscar-{serie.id}"
			type="search"
			bind:value={busqueda}
			placeholder="Type part of a title"
			autocomplete="off"
			aria-describedby="resultados-{serie.id}"
		/>
		<p id="resultados-{serie.id}" class="pista" role="status">
			{#if busqueda.trim()}
				{candidatos.length === 0
					? 'No video outside this series matches.'
					: candidatos.length === MAX_RESULTADOS
						? `First ${MAX_RESULTADOS} matches. Type more to narrow it down.`
						: `${candidatos.length} ${candidatos.length === 1 ? 'match' : 'matches'}.`}
			{/if}
		</p>
		{#if candidatos.length}
			<ul class="candidatos">
				{#each candidatos as v (v.id)}
					<li>
						<span lang="es">{v.titulo}</span>
						<button type="button" class="secundario" onclick={() => anadir(v)}
							>Add<span class="solo-lector"> {v.titulo}</span></button
						>
					</li>
				{/each}
			</ul>
		{/if}

		<p class="pista" role="status" aria-live="polite">{aviso}</p>
		<div class="guardar">
			<button type="submit">Save the series</button>
		</div>
	</form>

	<div class="acciones">
		<form method="post" action="?/resumirSerie" use:enhance>
			<input type="hidden" name="id" value={serie.id} />
			<button type="submit" class="secundario"
				>{serie.tieneResumen ? 'Draft a new overview' : 'Draft an overview'} with Muse Spark</button
			>
		</form>
		<a href={resolve('/series/[id]', { id: serie.id })}>Open the public page</a>
		{#if !confirmarBorrado}
			<button type="button" class="fantasma borrar" onclick={() => (confirmarBorrado = true)}
				>Delete the series…</button
			>
		{:else}
			<form
				method="post"
				action="?/borrarSerie"
				class="confirmar"
				use:enhance={() =>
					async ({ update }) => {
						// La URL sigue con ?serie=<borrada>: el panel muestra «Choose a series».
						await update();
					}}
			>
				<input type="hidden" name="id" value={serie.id} />
				<p role="alert">Delete “{serie.nombre}”? Its videos are kept.</p>
				<!-- El foco va a la opción segura de una confirmación destructiva. -->
				<!-- svelte-ignore a11y_autofocus -->
				<button
					type="button"
					class="secundario"
					autofocus
					onclick={() => (confirmarBorrado = false)}>Keep it</button
				>
				<button type="submit">Delete</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.editor {
		display: grid;
		gap: var(--e-8);
	}

	.campos {
		display: grid;
		gap: var(--e-2);
	}

	.fila-campos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		gap: var(--e-2) var(--e-4);
	}

	label {
		display: block;
		margin: var(--e-2) 0 var(--e-1);
		font-family: var(--letra-interfaz);
	}

	input[type='text'],
	input[type='search'],
	textarea {
		width: 100%;
	}

	h4 {
		margin: var(--e-6) 0 var(--e-1);
		font-family: var(--letra-interfaz);
		font-size: var(--t-1);
		font-weight: 700;
	}

	.partes,
	.candidatos {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--linea);
		border-radius: var(--radio-s);
		background: var(--papel-alto);
	}

	.partes li,
	.candidatos li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-1) var(--e-3);
		padding: var(--e-2) var(--e-3);
		font-family: var(--letra-interfaz);
	}

	.partes li + li,
	.candidatos li + li {
		border-top: 1px solid var(--linea);
	}

	.numero {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		background: var(--papel);
		color: var(--suave);
		font-variant-numeric: tabular-nums;
	}

	.nombre,
	.candidatos li span {
		flex: 1 1 12rem;
		min-width: 0;
	}

	.mover {
		display: flex;
		gap: var(--e-1);
	}

	.mover button,
	.candidatos button {
		min-height: 2.25rem;
		padding: 0 0.7rem;
		font-size: var(--t-0);
	}

	.mover button[disabled] {
		cursor: default;
		opacity: 0.45;
	}

	.pista {
		margin: 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	.pista:empty {
		display: none;
	}

	.nota {
		margin: 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
	}

	.guardar {
		margin-top: var(--e-4);
	}

	.acciones {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-3) var(--e-6);
		padding-top: var(--e-6);
		border-top: 1px solid var(--linea);
		font-family: var(--letra-interfaz);
	}

	.borrar {
		color: var(--rubrica);
	}

	.confirmar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2) var(--e-3);
		padding: var(--e-3) var(--e-4);
		border: 1px solid var(--rubrica);
		border-radius: var(--radio-s);
	}

	.confirmar p {
		flex: 1 1 100%;
		margin: 0;
	}
</style>
