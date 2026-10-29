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
	<title>Use this quote — Glosa</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="pagina">
	<h1>Use this quote</h1>
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
		<p class="compartir">
			Or share it as a short vertical video with subtitles:
			<a href={resolve('/c/[fragmento]', { fragmento: String(data.cita.fragmentoId) })}
				>Make a clip</a
			>
		</p>
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

	.compartir {
		margin: var(--e-6) 0 0;
		padding-top: var(--e-4);
		border-top: 1px solid var(--linea);
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}
</style>
