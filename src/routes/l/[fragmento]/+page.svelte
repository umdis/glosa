<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { folio } from '#lib/formato.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let haciendo = $state(false);
	let copiado = $state('');

	const listo = $derived(data.listo || (form && 'listo' in form && form.listo));
	const imagen = $derived(
		resolve('/l/[fragmento]/imagen/[clave]', {
			fragmento: String(data.fragmentoId),
			clave: data.clave
		})
	);
	const enlaceVideo = $derived(
		resolve(`/videos/[id]?t=${Math.floor(data.inicioMs / 1000)}#f-${data.fragmentoId}`, {
			id: data.videoId
		})
	);
	const estaPagina = $derived(`${data.origen}${page.url.pathname}${page.url.search}`);
	/** Open Graph exige direcciones absolutas; `resolve` las da relativas en el servidor. */
	const absoluta = (ruta: string) => new URL(ruta, estaPagina).href;

	async function copiar() {
		try {
			await navigator.clipboard.writeText(estaPagina);
			copiado = 'Link copied.';
		} catch {
			copiado = 'Select the address bar and copy the link.';
		}
	}
</script>

<svelte:head>
	<title>{data.titulo}, {folio(data.inicioMs)} — Glosa card</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content="{data.titulo}, {folio(data.inicioMs)}" />
	<meta property="og:description" content="«{data.frase}»" />
	<meta property="og:url" content={estaPagina} />
	{#if listo}
		<meta property="og:image" content={absoluta(imagen)} />
		<meta property="og:image:width" content="1080" />
		<meta property="og:image:height" content="1350" />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<article class="pagina">
	<div class="lamina">
		{#if listo}
			<img
				src={imagen}
				width="1080"
				height="1350"
				alt="Card with an ink illustration and the quote «{data.frase}», from {data.titulo} at {folio(
					data.inicioMs
				)}, with a QR code to that minute."
			/>
		{:else}
			<div class="hueco" aria-hidden="true"><span class="calderon">¶</span></div>
		{/if}
	</div>

	<div class="texto">
		<p class="sobre">A card to share, from</p>
		<h1 lang="es">{data.titulo}</h1>
		<blockquote lang="es">«{data.frase}»</blockquote>
		<p class="fuente">
			<a class="folio" href={enlaceVideo}>Hear it in context, ¶ {folio(data.inicioMs)}</a>
		</p>

		<div class="estado" role="status" aria-live="polite">
			{#if haciendo}<p>
					Muse Image is drawing the illustration and Glosa is setting the quote. About half a
					minute.
				</p>{/if}
			{#if copiado}<p>{copiado}</p>{/if}
		</div>
		{#if form && 'error' in form && form.error}<p class="error" role="alert">{form.error}</p>{/if}

		{#if listo}
			<div class="acciones">
				<a class="boton" href="{imagen}?descargar">Download the card</a>
				<button type="button" class="secundario" onclick={copiar}>Copy link to share</button>
			</div>
			<p class="nota">
				The QR code opens this minute in Glosa. The illustration is by Muse Image; it never shows
				people, and the quote was checked against the transcript.
			</p>
		{:else}
			<form
				method="post"
				use:enhance={() => {
					haciendo = true;
					return async ({ update }) => {
						await update();
						haciendo = false;
					};
				}}
			>
				<button type="submit" disabled={haciendo}
					>{haciendo ? 'Making the card…' : 'Make the card'}</button
				>
			</form>
			<p class="nota">
				Muse Image draws an illustration of the quote's theme, with no people and no text. Glosa
				adds the verified quote, its source and a QR code to the exact minute.
			</p>
		{/if}
	</div>
</article>

<style>
	.pagina {
		display: grid;
		gap: var(--e-8);
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) 5rem;
	}

	@media (min-width: 48rem) {
		.pagina {
			grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
			align-items: start;
		}
	}

	.lamina img,
	.hueco {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 4 / 5;
		border-radius: var(--radio-m);
		background: var(--papel);
		box-shadow: var(--sombra-2);
	}

	.hueco {
		display: grid;
		place-items: center;
	}

	.hueco .calderon {
		color: var(--rubrica);
		font-size: 4rem;
	}

	.sobre {
		margin: 0;
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
	}

	h1 {
		font-size: var(--t-4);
		font-style: italic;
		margin: var(--e-1) 0 var(--e-6);
	}

	blockquote {
		margin: 0;
		font-family: var(--letra-texto);
		font-size: var(--t-2);
		font-style: italic;
		line-height: 1.5;
	}

	.fuente {
		margin: var(--e-3) 0 var(--e-6);
		font-family: var(--letra-interfaz);
	}

	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
	}

	.estado p,
	.error {
		font-family: var(--letra-interfaz);
	}

	.nota {
		color: var(--suave);
		font-family: var(--letra-interfaz);
		font-size: var(--t-0);
		max-width: var(--medida);
		margin-top: var(--e-4);
	}
</style>
