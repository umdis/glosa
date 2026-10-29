<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let creando = $state(false);
</script>

<svelte:head>
	<title>Investigations — Glosa</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="pagina">
	<h1>Investigations</h1>
	<p class="nota">
		Gather verified quotes from the videos, put them in order, write around them, and export a study
		you can print, edit in Word or share. No account: each investigation has a private edit link.
	</p>

	{#if form && 'guardada' in form && form.guardada}
		<p class="aviso" role="status">
			Quote saved to
			<a href={resolve('/investigations/[id]', { id: form.guardada.id })}>{form.guardada.titulo}</a
			>.
		</p>
	{:else if form && 'error' in form && form.error && !('titulo' in form)}
		<p class="error" role="alert">{form.error}</p>
	{/if}

	<section class="crear tarjeta" aria-labelledby="t-crear">
		<h2 id="t-crear">Start an investigation</h2>
		<form
			method="post"
			action="?/crear"
			use:enhance={() => {
				creando = true;
				return async ({ update }) => {
					await update();
					creando = false;
				};
			}}
		>
			<label for="titulo-nueva">Title</label>
			<div class="fila">
				<input
					id="titulo-nueva"
					name="titulo"
					type="text"
					required
					maxlength="120"
					value={form && 'titulo' in form ? (form.titulo ?? '') : ''}
					placeholder="For example: Forgiveness in the family"
					aria-describedby={form && 'titulo' in form && form.error ? 'error-crear' : undefined}
				/>
				<button type="submit" disabled={creando}>{creando ? 'Creating…' : 'Create'}</button>
			</div>
			{#if form && 'titulo' in form && form.error}
				<p id="error-crear" class="error">{form.error}</p>
			{/if}
		</form>
	</section>

	<section aria-labelledby="t-mias">
		<h2 id="t-mias">Yours on this browser</h2>
		{#if data.misInvestigaciones.length}
			<ul class="lista">
				{#each data.misInvestigaciones as inv (inv.id)}
					<li><a href={resolve('/investigations/[id]', { id: inv.id })}>{inv.titulo}</a></li>
				{/each}
			</ul>
			<p class="nota pequena">
				This browser remembers them. To open one somewhere else, use its private edit link, which
				you can copy from the investigation.
			</p>
		{:else}
			<p class="vacio">
				None yet. Create one above, or use <strong>Save to investigation</strong> next to any quote in
				Ask, Search or a video.
			</p>
		{/if}
	</section>
</div>

<style>
	.pagina {
		max-width: 52rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) 5rem;
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
	}

	h2 {
		font-size: var(--t-3);
		font-style: italic;
		margin: 0 0 var(--e-4);
	}

	.nota {
		color: var(--suave);
		max-width: var(--medida);
		margin: var(--e-2) 0 var(--e-8);
	}

	.pequena {
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
		margin-top: var(--e-4);
	}

	.crear {
		padding: var(--e-6);
		margin-bottom: var(--e-12);
		font-family: var(--letra-interfaz);
	}

	label {
		display: block;
		margin-bottom: var(--e-2);
	}

	.fila {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
	}

	.fila input {
		flex: 1 1 16rem;
		min-width: 0;
	}

	.lista {
		display: grid;
		gap: var(--e-3);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--t-2);
	}

	.aviso,
	.vacio {
		max-width: var(--medida);
	}

	.aviso {
		font-family: var(--letra-interfaz);
		border-left: 2px solid var(--rubrica);
		padding-left: var(--e-3);
		margin-bottom: var(--e-8);
	}

	.vacio {
		color: var(--suave);
	}
</style>
