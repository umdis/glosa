<script lang="ts">
	import { borradorEstudio, markdownImprimible } from '#lib/estudio.js';

	interface Props {
		respuesta: Parameters<typeof borradorEstudio>[0];
		origen: string;
	}

	let { respuesta, origen }: Props = $props();

	let abierto = $state(false);
	let texto = $state('');
	let campo = $state<HTMLTextAreaElement>();

	function abrir() {
		texto = borradorEstudio(respuesta, origen);
		abierto = true;
		queueMicrotask(() => campo?.focus());
	}

	function descargar() {
		const enlace = document.createElement('a');
		enlace.href = URL.createObjectURL(new Blob([texto], { type: 'text/markdown;charset=utf-8' }));
		enlace.download = `${
			respuesta.pregunta
				.replace(/[^\p{L}\p{N}]+/gu, '-')
				.replace(/^-|-$/g, '')
				.slice(0, 60) || 'estudio'
		}.md`;
		enlace.click();
		URL.revokeObjectURL(enlace.href);
	}

	// El HTML sale de markdownImprimible, que escapa todo lo escrito antes de convertir.
	const imprimible = $derived(markdownImprimible(texto));
</script>

{#if !abierto}
	<button type="button" class="secundario" onclick={abrir}>Write a study from this answer</button>
{:else}
	<section class="estudio" aria-labelledby="t-estudio">
		<h2 id="t-estudio">Your study</h2>
		<p class="nota">
			A draft with the verified quotes only. Edit it freely, then download or print it: Glosa does
			not store it. Links take readers to the exact moment of each quote.
		</p>
		<label for="texto-estudio">Study text (Markdown)</label>
		<textarea id="texto-estudio" bind:this={campo} bind:value={texto} rows="16" lang="es"
		></textarea>
		<div class="acciones">
			<button type="button" onclick={descargar}>Download Markdown</button>
			<button type="button" class="secundario" onclick={() => window.print()}
				>Print or save as PDF</button
			>
		</div>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML escapado por markdownImprimible -->
		<div class="para-imprimir" lang="es">{@html imprimible}</div>
	</section>
{/if}

<style>
	.estudio {
		margin-top: 2.5rem;
		max-width: var(--medida);
	}

	h2 {
		font-size: var(--t-3);
	}

	.nota {
		color: var(--suave);
		font-family: var(--letra-interfaz);
	}

	label {
		display: block;
		font-family: var(--letra-interfaz);
		margin: 1rem 0 0.3rem;
	}

	textarea {
		width: 100%;
		font-family: var(--letra-texto);
		font-size: var(--t-1);
		line-height: 1.55;
		background: var(--papel);
		color: var(--tinta);
		border: 1px solid var(--suave);
		border-radius: 3px;
		padding: 0.7rem;
	}

	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.para-imprimir {
		display: none;
	}

	/* Al imprimir, la página entera desaparece y solo queda el estudio, como un documento. */
	@media print {
		:global(body *) {
			visibility: hidden;
		}
		.para-imprimir,
		:global(.para-imprimir *) {
			visibility: visible;
		}
		.para-imprimir {
			display: block;
			position: absolute;
			inset: 0;
			padding: 2cm;
			color: #000;
			background: #fff;
			font-family: var(--letra-texto);
			font-size: 12pt;
		}
		:global(.para-imprimir blockquote) {
			margin: 0.5em 0 1em 1.5em;
			font-style: italic;
		}
		:global(.para-imprimir a) {
			color: #000;
		}
	}
</style>
