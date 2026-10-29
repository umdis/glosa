<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CitaPorGuardar } from '#lib/investigaciones.js';

	interface Props {
		cita: CitaPorGuardar;
		investigaciones: Array<{ id: string; titulo: string }>;
		/** Dentro del diálogo, al guardar se queda en la misma página; fuera, se sigue la acción. */
		enDialogo?: boolean;
		alGuardar?: (guardada: { id: string; titulo: string }) => void;
		alCancelar?: () => void;
	}

	let { cita, investigaciones, enDialogo = false, alGuardar, alCancelar }: Props = $props();

	// Por defecto, la última usada (la cookie las ordena de la más reciente a la más antigua).
	// Es solo el valor inicial: el diálogo monta un formulario nuevo por cita.
	// svelte-ignore state_referenced_locally
	let destino = $state(investigaciones[0]?.id ?? 'nueva');
	let enviando = $state(false);
	let error = $state('');
</script>

<form
	method="post"
	action="{resolve('/investigations')}?/guardarCita"
	class="guardar"
	use:enhance={() => {
		enviando = true;
		error = '';
		return async ({ result }) => {
			enviando = false;
			if (!enDialogo) return applyAction(result);
			if (result.type === 'success' && result.data?.guardada) {
				await invalidateAll();
				alGuardar?.(result.data.guardada as { id: string; titulo: string });
			} else if (result.type === 'failure') {
				error = String(result.data?.error ?? 'The quote could not be saved.');
			} else {
				error = 'The quote could not be saved. Try again.';
			}
		};
	}}
>
	<input type="hidden" name="fragmento" value={cita.fragmentoId} />
	<input type="hidden" name="frase" value={cita.frase} />

	<blockquote lang="es">«{cita.frase}»</blockquote>
	<p class="de">{cita.etiqueta}</p>

	<label for="destino-{cita.fragmentoId}">Save to</label>
	<select id="destino-{cita.fragmentoId}" name="investigacion" bind:value={destino}>
		{#each investigaciones as inv (inv.id)}
			<option value={inv.id}>{inv.titulo}</option>
		{/each}
		<option value="nueva">A new investigation…</option>
	</select>

	{#if destino === 'nueva'}
		<label for="titulo-{cita.fragmentoId}">Title of the new investigation</label>
		<input
			id="titulo-{cita.fragmentoId}"
			name="titulo"
			type="text"
			required
			maxlength="120"
			placeholder="For example: Forgiveness in the family"
		/>
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<div class="acciones">
		<button type="submit" disabled={enviando}>{enviando ? 'Saving…' : 'Save quote'}</button>
		{#if alCancelar}
			<button type="button" class="secundario" onclick={alCancelar}>Cancel</button>
		{/if}
	</div>
</form>

<style>
	.guardar {
		display: grid;
		gap: var(--e-2);
		font-family: var(--letra-interfaz);
	}

	blockquote {
		margin: 0;
		font-family: var(--letra-texto);
		font-size: var(--t-1);
		font-style: italic;
		line-height: 1.5;
		max-height: 9.5em;
		overflow: auto;
	}

	.de {
		margin: 0 0 var(--e-3);
		color: var(--suave);
		font-size: var(--t-0);
	}

	label {
		margin-top: var(--e-2);
	}

	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
		margin-top: var(--e-4);
	}

	.error {
		margin: 0;
	}
</style>
