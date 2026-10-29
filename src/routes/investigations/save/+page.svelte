<script lang="ts">
	import { resolve } from '$app/paths';
	import GuardarCita from '#lib/componentes/GuardarCita.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let guardadaEn = $state<{ id: string; titulo: string }>();
	let aviso = $state<HTMLElement>();

	$effect(() => {
		if (guardadaEn) aviso?.focus();
	});
</script>

<svelte:head>
	<title>Save to an investigation — Glosa</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="pagina">
	<h1>Save to an investigation</h1>
	<div class="tarjeta caja">
		{#if guardadaEn}
			<p role="status" tabindex="-1" bind:this={aviso}>
				Saved to
				<a href={resolve('/investigations/[id]', { id: guardadaEn.id })}>{guardadaEn.titulo}</a>.
			</p>
		{:else}
			<!-- Sin JavaScript, el formulario lleva a /investigations, que confirma lo guardado. -->
			<GuardarCita
				cita={data.cita}
				investigaciones={data.misInvestigaciones}
				enDialogo
				alGuardar={(g) => (guardadaEn = g)}
			/>
		{/if}
	</div>
</div>

<style>
	.pagina {
		max-width: 40rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) 5rem;
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
	}

	.caja {
		padding: var(--e-6);
	}
</style>
