<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { folio } from '#lib/formato.js';

	interface Props {
		videoId: string;
		/** Segundo del cuadro; el servidor lo ajusta a la duración del video. */
		segundo: number;
		ancho?: 320 | 640;
		/** Nombre para View Transitions: el póster pasa al reproductor como la misma pieza. */
		transicion?: string;
		clase?: string;
	}

	let { videoId, segundo, ancho = 320, transicion, clase = '' }: Props = $props();

	let fallo = $state(false);
	const activos = $derived(page.data.fotogramas !== false);
	const fuente = $derived(
		`${resolve('/videos/[id]/fotograma/[segundo]', { id: videoId, segundo: String(Math.floor(segundo)) })}?w=${ancho}`
	);
</script>

<!--
	El cuadro es adorno: el título y el minuto van siempre al lado en texto, así que alt="".
	Sin fotogramas (apagados o fallidos) queda el folio grande sobre papel.
-->
<div class="fotograma {clase}" style:view-transition-name={transicion}>
	{#if activos && !fallo}
		<img
			src={fuente}
			alt=""
			width={ancho}
			height={Math.round((ancho * 9) / 16)}
			loading="lazy"
			decoding="async"
			onerror={() => (fallo = true)}
		/>
	{:else}
		<span class="respaldo" aria-hidden="true">¶ {folio(segundo * 1000)}</span>
	{/if}
</div>

<style>
	.fotograma {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: inherit;
		background: var(--papel);
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.respaldo {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--suave);
		font-family: var(--letra-texto);
		font-size: clamp(var(--t-1), 6cqi, var(--t-4));
		font-style: italic;
		font-variant-numeric: lining-nums tabular-nums;
		container-type: inline-size;
	}
</style>
