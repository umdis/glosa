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
	const segundos = $derived(Math.round(data.duracionMs / 1000));
	const archivo = $derived(
		resolve('/c/[fragmento]/clip.mp4', { fragmento: String(data.fragmentoId) })
	);
	const enlaceVideo = $derived(
		resolve(`/videos/[id]?t=${Math.floor(data.inicioMs / 1000)}#f-${data.fragmentoId}`, {
			id: data.video.id
		})
	);
	const estaPagina = $derived(`${data.origen}${page.url.pathname}`);
	/**
	 * Open Graph exige direcciones absolutas, y `resolve` las da relativas en el servidor
	 * («../videos/…»): se resuelven contra la dirección de esta página.
	 */
	const absoluta = (ruta: string) => new URL(ruta, estaPagina).href;
	const imagen = $derived(
		absoluta(
			`${resolve('/videos/[id]/fotograma/[segundo]', { id: data.video.id, segundo: String(Math.floor(data.inicioMs / 1000)) })}?w=640`
		)
	);
	const resumen = $derived(
		data.frase.length > 180 ? `${data.frase.slice(0, 177).trimEnd()}…` : data.frase
	);

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
	<title>{data.video.titulo}, {folio(data.inicioMs)} — Glosa</title>
	<meta property="og:type" content="video.other" />
	<meta property="og:title" content="{data.video.titulo}, {folio(data.inicioMs)}" />
	<meta property="og:description" content="«{resumen}»" />
	<meta property="og:url" content={estaPagina} />
	{#if page.data.fotogramas !== false}
		<meta property="og:image" content={imagen} />
	{/if}
	{#if listo}
		<meta property="og:video" content={absoluta(archivo)} />
		<meta property="og:video:type" content="video/mp4" />
		<meta property="og:video:width" content="1080" />
		<meta property="og:video:height" content="1920" />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<article class="pagina">
	<div class="clip">
		{#if listo}
			<!-- Sin <track>: los subtítulos van quemados en la imagen. -->
			<!-- svelte-ignore a11y_media_has_caption -->
			<video controls playsinline preload="metadata" src={archivo} width="1080" height="1920"
			></video>
		{:else}
			<div class="hueco" aria-hidden="true">
				<span class="calderon">¶</span>
			</div>
		{/if}
	</div>

	<div class="texto">
		<p class="sobre">A {segundos}-second clip from</p>
		<h1 lang="es">{data.video.titulo}</h1>
		<blockquote lang="es">«{data.frase}»</blockquote>
		<p class="fuente">
			<a class="folio" href={enlaceVideo}>Watch it in context, ¶ {folio(data.inicioMs)}</a>
		</p>

		<div class="estado" role="status" aria-live="polite">
			{#if haciendo}<p>
					Making the clip with the transcript as subtitles. About half a minute.
				</p>{/if}
			{#if copiado}<p>{copiado}</p>{/if}
		</div>
		{#if form && 'error' in form && form.error}<p class="error" role="alert">{form.error}</p>{/if}

		{#if listo}
			<div class="acciones">
				<a class="boton" href={archivo} download="glosa-clip-{data.fragmentoId}.mp4"
					>Download the clip</a
				>
				<button type="button" class="secundario" onclick={copiar}>Copy link to share</button>
			</div>
			<p class="nota">
				Vertical video with the transcript burned in as subtitles, ready for WhatsApp, Instagram or
				a projector. The link shows a preview when you paste it in a chat.
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
					>{haciendo ? 'Making the clip…' : 'Make the clip'}</button
				>
			</form>
			<p class="nota">
				Glosa cuts {segundos} seconds around this moment, only from passages that are public, and adds
				the transcript as subtitles.
			</p>
		{/if}
	</div>
</article>

<style>
	.pagina {
		display: grid;
		gap: var(--e-8);
		max-width: 60rem;
		margin: 0 auto;
		padding: var(--e-8) var(--margen) 5rem;
	}

	@media (min-width: 48rem) {
		.pagina {
			grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
			align-items: start;
		}
	}

	.clip video,
	.hueco {
		display: block;
		width: 100%;
		height: auto;
		max-height: 75vh;
		aspect-ratio: 9 / 16;
		border-radius: var(--radio-m);
		background: #1f2a28;
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
