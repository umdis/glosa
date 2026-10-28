<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '#lib/estilos/base.css';
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const enPortada = $derived(page.url.pathname === '/');

	/** Transición entre páginas donde el navegador la tenga y nadie haya pedido menos movimiento. */
	onNavigate((navegacion) => {
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
	</nav>
</header>

<main id="contenido" tabindex="-1">
	{@render children()}
</main>

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

	@media (forced-colors: active) {
		.cabecera {
			background: Canvas;
		}
	}
</style>
