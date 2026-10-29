<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '#lib/estilos/base.css';
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import GuardarCita from '#lib/componentes/GuardarCita.svelte';
	import type { CitaPorGuardar } from '#lib/investigaciones.js';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	/*
	 * «Save to investigation»: cada cita lleva un enlace a /investigations/save (sirve sin
	 * JavaScript). Con JavaScript, el enlace abre este diálogo nativo, que atrapa el foco, se cierra
	 * con Escape y devuelve el foco al enlace que lo abrió.
	 */
	let dialogo = $state<HTMLDialogElement>();
	let citaPorGuardar = $state<CitaPorGuardar>();
	let guardadaEn = $state<{ id: string; titulo: string }>();

	/** Escucha en captura: el router de SvelteKit atiende los enlaces antes, en la burbuja. */
	function abrirGuardar(evento: MouseEvent) {
		if (evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey) return;
		const enlace = (evento.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
			'a[data-guardar-cita]'
		);
		if (!enlace || !dialogo) return;
		const url = new URL(enlace.href);
		const fragmentoId = Number(url.searchParams.get('f'));
		if (!Number.isInteger(fragmentoId)) return;
		evento.preventDefault();
		guardadaEn = undefined;
		citaPorGuardar = {
			fragmentoId,
			frase: url.searchParams.get('q') ?? enlace.dataset.texto ?? '',
			etiqueta: enlace.dataset.etiqueta ?? ''
		};
		// Abrir cuando el formulario ya está pintado, para que el foco caiga en su primer campo.
		const abrir = dialogo;
		tick().then(() => abrir.showModal());
	}

	function cerrarGuardar() {
		dialogo?.close();
	}

	// Al guardar, el formulario desaparece: el foco pasa al enlace de la investigación.
	let abrirGuardada = $state<HTMLAnchorElement>();
	$effect(() => {
		if (guardadaEn) abrirGuardada?.focus();
	});

	const enPortada = $derived(page.url.pathname === '/');

	/** Transición entre páginas donde el navegador la tenga y nadie haya pedido menos movimiento. */
	onNavigate((navegacion) => {
		dialogo?.close();
		if (!document.startViewTransition) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise((listo) => {
			document.startViewTransition(async () => {
				listo();
				await navegacion.complete;
			});
		});
	});

	/** «/» lleva a la búsqueda, salvo mientras se escribe en otro campo. */
	function atajo(evento: KeyboardEvent) {
		if (evento.key !== '/' || evento.ctrlKey || evento.metaKey || evento.altKey) return;
		const destino = evento.target as HTMLElement | null;
		if (destino?.closest('input, textarea, select, [contenteditable="true"]')) return;
		const campo = [...document.querySelectorAll<HTMLInputElement>('[data-atajo-buscar]')].find(
			(c) => c.offsetParent !== null
		);
		if (!campo) return;
		evento.preventDefault();
		campo.focus();
		campo.select();
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window onkeydown={atajo} />
<svelte:document onclickcapture={abrirGuardar} />

<a class="saltar" href="#contenido">Skip to content</a>

<header class="cabecera">
	<a class="marca" href={resolve('/')} aria-label="Glosa, home"
		><span class="calderon" aria-hidden="true">¶</span> Glosa</a
	>
	{#if !enPortada}
		<form class="buscar" action="/search" method="get" role="search">
			<label class="solo-lector" for="buscar-cabecera">Search what was said</label>
			<div class="campo-buscar">
				<svg viewBox="0 0 20 20" aria-hidden="true"
					><circle
						cx="8.5"
						cy="8.5"
						r="5.5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
					/><path
						d="M13 13l4.5 4.5"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
					/></svg
				>
				<input
					id="buscar-cabecera"
					name="q"
					type="search"
					placeholder="Search what was said"
					value={page.url.pathname === '/search' ? (page.url.searchParams.get('q') ?? '') : ''}
					autocomplete="off"
					aria-keyshortcuts="/"
					data-atajo-buscar
				/>
				<kbd class="pista" aria-hidden="true">/</kbd>
			</div>
		</form>
	{/if}
	<nav aria-label="Main">
		<a
			class="chip"
			href={resolve('/ask')}
			aria-current={page.url.pathname === '/ask' ? 'page' : undefined}>Ask the collection</a
		>
		<a
			class="chip"
			href={resolve('/passages')}
			aria-current={page.url.pathname === '/passages' ? 'page' : undefined}>Scripture index</a
		>
		<a
			class="chip"
			href={resolve('/investigations')}
			aria-current={page.url.pathname.startsWith('/investigations') ? 'page' : undefined}
			>Investigations{#if data.misInvestigaciones.length}<span class="cuenta"
					><span class="solo-lector">, </span>{data.misInvestigaciones.length}</span
				>{/if}</a
		>
	</nav>
</header>

<main id="contenido" tabindex="-1">
	{@render children()}
</main>

<dialog
	bind:this={dialogo}
	class="dialogo-guardar tarjeta"
	aria-labelledby="t-guardar"
	onclose={() => (citaPorGuardar = undefined)}
>
	<h2 id="t-guardar">Save to an investigation</h2>
	{#if guardadaEn}
		<p role="status">
			Saved to <a href={resolve('/investigations/[id]', { id: guardadaEn.id })}
				>{guardadaEn.titulo}</a
			>.
		</p>
		<div class="acciones-dialogo">
			<a
				class="boton"
				bind:this={abrirGuardada}
				href={resolve('/investigations/[id]', { id: guardadaEn.id })}>Open the investigation</a
			>
			<button type="button" class="secundario" onclick={cerrarGuardar}>Keep reading</button>
		</div>
	{:else if citaPorGuardar}
		{#key citaPorGuardar}
			<GuardarCita
				cita={citaPorGuardar}
				investigaciones={data.misInvestigaciones}
				enDialogo
				alGuardar={(g) => (guardadaEn = g)}
				alCancelar={cerrarGuardar}
			/>
		{/key}
	{/if}
</dialog>

<style>
	.saltar {
		position: absolute;
		left: var(--margen);
		top: -4rem;
		padding: 0.5rem 0.9rem;
		border-radius: var(--radio-s);
		background: var(--tinta);
		color: var(--fondo);
		font-family: var(--letra-interfaz);
		z-index: 20;
	}
	.saltar:focus {
		top: 0.75rem;
	}

	main {
		outline: none;
	}

	/* Fija y translúcida: la vitela se ve pasar por debajo sin perder la lectura de la barra. */
	.cabecera {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-3) var(--e-8);
		min-height: var(--alto-cabecera);
		padding: var(--e-3) var(--margen);
		border-bottom: 1px solid var(--linea);
		background: color-mix(in srgb, var(--fondo) 88%, transparent);
		backdrop-filter: blur(10px) saturate(1.2);
	}

	.marca {
		font-size: var(--t-3);
		font-style: italic;
		font-weight: 500;
		line-height: 1;
		text-decoration: none;
		white-space: nowrap;
	}

	.calderon {
		color: var(--rubrica);
		font-style: normal;
	}

	.buscar {
		flex: 1 1 18rem;
		max-width: 30rem;
	}

	.buscar input {
		padding-right: 2.6rem;
	}

	.pista {
		position: absolute;
		right: 0.7rem;
		pointer-events: none;
	}

	.buscar input:focus ~ .pista {
		visibility: hidden;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
		margin-left: auto;
	}

	@media (max-width: 48rem) {
		:global(:root) {
			--alto-cabecera: 7.5rem;
		}
		.cabecera {
			gap: var(--e-2) var(--e-4);
		}
		.buscar {
			order: 3;
			flex-basis: 100%;
			max-width: none;
		}
		.pista {
			display: none;
		}
	}

	/* Cuántas investigaciones tiene este navegador: un número discreto junto al nombre. */
	.cuenta {
		margin-left: 0.4rem;
		padding: 0 0.45rem;
		border-radius: 999px;
		background: var(--papel);
		color: var(--tinta);
		font-size: var(--t-0);
		font-variant-numeric: tabular-nums;
	}

	.dialogo-guardar {
		width: min(34rem, calc(100vw - 2 * var(--margen)));
		max-height: calc(100dvh - 2 * var(--margen));
		padding: var(--e-6);
		color: var(--tinta);
		overflow: auto;
	}

	.dialogo-guardar::backdrop {
		background: color-mix(in srgb, var(--tinta) 45%, transparent);
	}

	.dialogo-guardar h2 {
		margin: 0 0 var(--e-4);
		font-size: var(--t-3);
		font-style: italic;
	}

	.acciones-dialogo {
		display: flex;
		flex-wrap: wrap;
		gap: var(--e-2);
		margin-top: var(--e-4);
	}

	@media (forced-colors: active) {
		.cabecera {
			background: Canvas;
		}
		.dialogo-guardar {
			border: 1px solid CanvasText;
		}
	}
</style>
