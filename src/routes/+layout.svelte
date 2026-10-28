<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '#lib/estilos/base.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const enPortada = $derived(page.url.pathname === '/');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="saltar" href="#contenido">Skip to content</a>

{#if !enPortada}
	<header class="cabecera">
		<a class="marca" href={resolve('/')}>Glosa</a>
		<form class="buscar" action="/search" method="get" role="search">
			<label class="solo-lector" for="buscar-cabecera">Search what was said</label>
			<input
				id="buscar-cabecera"
				name="q"
				type="search"
				placeholder="Search what was said"
				value={page.url.pathname === '/search' ? (page.url.searchParams.get('q') ?? '') : ''}
				autocomplete="off"
			/>
			<button type="submit">Search</button>
		</form>
	</header>
{/if}

<main id="contenido" tabindex="-1">
	{@render children()}
</main>

<style>
	.saltar {
		position: absolute;
		left: var(--margen);
		top: -4rem;
		padding: 0.5rem 0.9rem;
		background: var(--tinta);
		color: var(--fondo);
		font-family: var(--letra-interfaz);
		z-index: 10;
	}
	.saltar:focus {
		top: 0.75rem;
	}

	main {
		outline: none;
	}

	.cabecera {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem 2rem;
		padding: 1.25rem var(--margen) 0;
	}

	.marca {
		font-size: var(--t-3);
		font-style: italic;
		font-weight: 500;
		text-decoration: none;
	}

	.buscar {
		display: flex;
		gap: 0.5rem;
		flex: 1 1 18rem;
		max-width: 28rem;
	}

	.buscar input {
		flex: 1;
		min-width: 0;
	}

	:global(input[type='search']),
	:global(button) {
		font-family: var(--letra-interfaz);
		font-size: var(--t-1);
		color: var(--tinta);
		min-height: 2.75rem;
		border-radius: 3px;
	}

	:global(input[type='search']) {
		background: var(--papel);
		border: 1px solid var(--suave);
		padding: 0.4rem 0.7rem;
	}

	:global(button) {
		background: var(--tinta);
		color: var(--fondo);
		border: 1px solid var(--tinta);
		padding: 0.4rem 1rem;
		cursor: pointer;
	}
</style>
