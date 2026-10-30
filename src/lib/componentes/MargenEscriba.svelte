<script lang="ts">
	import {
		agruparEtapas,
		compactarPasos,
		type Etapa,
		type PasoAgente,
		type PasoMostrado
	} from '#lib/traza.js';

	/**
	 * El margen del escriba (interfaz-con-volumen): las cuatro etapas de una respuesta y, debajo de
	 * cada una, los pasos reales del agente según llegan. En reposo explica cómo se responde; nunca
	 * dibuja un paso que no ocurrió.
	 */
	let {
		pasos,
		trabajando,
		segundos = null,
		completa = true
	}: {
		pasos: PasoAgente[];
		trabajando: boolean;
		segundos?: number | null;
		/** false si los pasos salen de una respuesta guardada o sin JS: no se vio todo lo que hizo. */
		completa?: boolean;
	} = $props();

	const etapas = $derived(agruparEtapas(pasos, trabajando, completa));
	const enReposo = $derived(!trabajando && pasos.length === 0);

	const TEXTOS: Record<Etapa['clave'], { titulo: string; quien: string; como: string }> = {
		buscar: {
			titulo: 'Search the transcripts',
			quien: 'Muse Spark',
			como: 'Searches several times, with the words the speaker would use.'
		},
		leer: {
			titulo: 'Read in context',
			quien: 'Muse Spark',
			como: 'Reads what was said around each match before relying on it.'
		},
		redactar: {
			titulo: 'Write the answer',
			quien: 'Muse Spark',
			como: 'Writes short claims from what it read, each with a word-for-word quote.'
		},
		verificar: {
			titulo: 'Check every quote',
			quien: 'Glosa, not the model',
			como: 'Finds each quote in the transcript and takes its minute from there.'
		}
	};

	const NOMBRES_IDIOMA: Record<string, string> = {
		en: 'English',
		pt: 'Portuguese',
		fr: 'French',
		de: 'German',
		it: 'Italian'
	};

	const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

	function describir(paso: PasoMostrado): { texto: string; cifra: string } {
		if (paso.tipo === 'redactar') {
			return {
				texto: 'Using only what it read',
				cifra: paso.fragmentos < 0 ? '' : plural(paso.fragmentos, 'passage', 'passages')
			};
		}
		if (paso.tipo === 'traducir') {
			return {
				texto: `Quotes translated into ${NOMBRES_IDIOMA[paso.idioma] ?? paso.idioma}`,
				cifra: plural(paso.citas, 'quote', 'quotes')
			};
		}
		if (paso.tipo === 'verificar') {
			return {
				texto: 'Found word for word',
				cifra: `${paso.verificadas} of ${plural(paso.citas, 'quote', 'quotes')}`
			};
		}
		const cifra =
			paso.resultados < 0
				? ''
				: paso.resultados === 0
					? 'nothing'
					: plural(paso.resultados, 'passage', 'passages');
		// Lo repetido va junto: «8 reads, 48 passages» en vez de ocho líneas iguales.
		const veces =
			paso.veces > 1
				? `${paso.veces} ${paso.herramienta === 'leer_fragmentos' ? 'reads' : 'times'}${cifra ? ', ' : ''}`
				: '';
		switch (paso.herramienta) {
			case 'buscar':
				return { texto: `“${paso.detalle}”`, cifra: veces + cifra };
			case 'pasajes':
				return { texto: `Scripture index: ${paso.detalle}`, cifra: veces + cifra };
			case 'en_pantalla':
				return { texto: 'Slides and whiteboard', cifra: veces + cifra };
			case 'leer_fragmentos':
				return { texto: paso.detalle || 'Around a match', cifra: veces + cifra };
			default:
				return { texto: 'The list of videos', cifra };
		}
	}

	const estadoLegible: Record<string, string> = {
		pendiente: 'not started',
		activa: 'in progress',
		hecha: 'done',
		omitida: 'not needed',
		'sin-registro': 'not recorded'
	};
</script>

<section class="margen" class:en-reposo={enReposo} aria-labelledby="t-margen">
	<header>
		<h2 id="t-margen">{enReposo ? 'How an answer is made' : 'How this answer was made'}</h2>
		{#if trabajando}
			<p class="reloj" aria-hidden="true">{segundos ?? 0} s</p>
		{:else if segundos !== null && pasos.length}
			<p class="reloj">in {segundos} s</p>
		{/if}
	</header>

	<div role="log" aria-label="What the agent did">
		<ol class="etapas">
			{#each etapas as etapa (etapa.clave)}
				{@const t = TEXTOS[etapa.clave]}
				<li class="etapa {etapa.estado}">
					<span class="nudo" aria-hidden="true">
						{#if etapa.estado === 'hecha'}
							<svg viewBox="0 0 16 16"><path d="M4.5 8.4l2.3 2.3 4.7-5" /></svg>
						{/if}
					</span>
					<p class="titulo">
						{t.titulo}<span class="solo-lector">, {estadoLegible[etapa.estado]}</span>
					</p>
					<p class="quien">by {t.quien}</p>
					{#if enReposo || (etapa.estado === 'activa' && etapa.pasos.length === 0)}
						<p class="como">{t.como}</p>
					{/if}
					{#if etapa.pasos.length}
						<ul class="pasos">
							{#each compactarPasos(etapa.pasos) as paso, i (i)}
								{@const d = describir(paso)}
								<li>
									<span class="que" lang={paso.tipo === 'herramienta' ? 'es' : undefined}
										>{d.texto}</span
									>
									{#if d.cifra}<span class="cifra">{d.cifra}</span>{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ol>
	</div>
</section>

<style>
	/* Una hoja de lámina: el único lugar de «Preguntar» con movimiento orquestado. */
	.margen {
		padding: var(--e-6);
		border-radius: var(--radio-l);
		background: var(--lamina);
		color: var(--lamina-tinta);
		font-family: var(--letra-interfaz);
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--e-4);
		margin-bottom: var(--e-6);
	}

	h2 {
		font-family: var(--letra-texto);
		font-size: var(--t-2);
		font-style: italic;
	}

	.reloj {
		margin: 0;
		color: var(--lamina-suave);
		font-variant-numeric: tabular-nums;
	}

	.etapas {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* La pauta: un filete vertical une los nudos, como la regla de un escriba. */
	.etapa {
		position: relative;
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr);
		column-gap: var(--e-3);
		padding-bottom: var(--e-6);
	}

	.etapa:not(:last-child)::before {
		content: '';
		position: absolute;
		left: calc(0.75rem - 1px);
		top: 1.6rem;
		bottom: 0.2rem;
		border-left: 2px solid var(--lamina-linea);
	}

	.etapa.hecha:not(:last-child)::before {
		border-left-color: var(--lamina-rubrica);
	}

	.etapa > :not(.nudo) {
		grid-column: 2;
	}

	.nudo {
		grid-row: 1 / span 2;
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		margin-top: 0.1rem;
		border: 2px solid var(--lamina-suave);
		border-radius: 50%;
	}

	.hecha .nudo {
		border-color: var(--lamina-rubrica);
		background: var(--lamina-rubrica);
	}

	.nudo svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: none;
		stroke: var(--lamina);
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.activa .nudo {
		border-color: var(--lamina-rubrica);
		box-shadow:
			inset 0 0 0 4px var(--lamina),
			inset 0 0 0 10px var(--lamina-rubrica);
	}

	.omitida .nudo,
	.sin-registro .nudo {
		border-style: dashed;
	}

	.titulo {
		margin: 0;
		font-family: var(--letra-texto);
		font-size: var(--t-1);
		line-height: 1.3;
	}

	.pendiente .titulo,
	.omitida .titulo,
	.sin-registro .titulo {
		color: var(--lamina-suave);
	}

	.quien,
	.como {
		margin: 0.1rem 0 0;
		color: var(--lamina-suave);
		font-size: var(--t-0);
	}

	.como {
		margin-top: var(--e-2);
		max-width: 22rem;
		line-height: 1.45;
	}

	.pasos {
		display: grid;
		gap: var(--e-1);
		margin: var(--e-3) 0 0;
		padding: 0;
		list-style: none;
	}

	.pasos li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0 var(--e-3);
		padding: var(--e-1) 0;
		border-bottom: 1px solid var(--lamina-linea);
	}

	.que {
		min-width: 0;
		overflow-wrap: anywhere;
		font-family: var(--letra-texto);
	}

	.cifra {
		color: var(--lamina-suave);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	@media (forced-colors: active) {
		.margen {
			border: 1px solid CanvasText;
		}
		.hecha .nudo {
			background: CanvasText;
		}
	}

	/* Cada paso entra escribiéndose; el nudo activo late. Nada de esto con movimiento reducido. */
	@media (prefers-reduced-motion: no-preference) {
		.pasos li {
			animation: entrar var(--dur-media) var(--curva) both;
		}
		.activa .nudo {
			animation: latir 1.4s ease-in-out infinite;
		}
		@keyframes entrar {
			from {
				opacity: 0;
				transform: translateX(-0.5rem);
			}
		}
		@keyframes latir {
			50% {
				box-shadow:
					inset 0 0 0 6px var(--lamina),
					inset 0 0 0 10px var(--lamina-rubrica);
			}
		}
	}
</style>
