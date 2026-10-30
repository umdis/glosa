<script lang="ts">
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';

	/**
	 * Dictar la pregunta (spec idiomas-y-voz; design.md D7). Graba con el micrófono hasta 30 s,
	 * convierte a WAV mono de 16 kHz en el navegador y lo transcribe con Muse Voice. El texto queda
	 * en el campo para revisarlo: nunca se envía solo. El audio no se guarda.
	 */
	let { alTranscribir }: { alTranscribir: (texto: string) => void } = $props();

	const MAXIMO = 30;
	type Estado = 'listo' | 'grabando' | 'transcribiendo';
	let estado = $state<Estado>('listo');
	let mensaje = $state('');
	let error = $state('');
	let restantes = $state(MAXIMO);
	let disponible = $state(false);

	let grabadora: MediaRecorder | undefined;
	let flujo: MediaStream | undefined;
	let trozos: Blob[] = [];
	let reloj: ReturnType<typeof setInterval> | undefined;

	// Sin micrófono ni MediaRecorder (o sin JS), el botón no aparece: el campo de texto basta.
	onMount(() => {
		disponible = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
	});

	onDestroy(() => detenerTodo());

	function detenerTodo() {
		clearInterval(reloj);
		flujo?.getTracks().forEach((t) => t.stop());
		flujo = undefined;
	}

	async function alternar() {
		if (estado === 'grabando') return grabadora?.stop();
		if (estado !== 'listo') return;
		error = '';
		try {
			flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (fallo) {
			const nombre = (fallo as DOMException)?.name;
			error =
				nombre === 'NotAllowedError'
					? 'The browser blocked the microphone. Allow it from the icon next to the address bar, or type the question.'
					: 'No microphone was found. You can type the question.';
			return;
		}
		trozos = [];
		grabadora = new MediaRecorder(flujo);
		grabadora.ondataavailable = (e) => e.data.size && trozos.push(e.data);
		grabadora.onstop = transcribir;
		grabadora.start();
		estado = 'grabando';
		restantes = MAXIMO;
		mensaje = `Recording. Press Stop when you finish; it stops by itself after ${MAXIMO} seconds.`;
		reloj = setInterval(() => {
			restantes--;
			if (restantes <= 0) grabadora?.stop();
		}, 1000);
	}

	async function transcribir() {
		detenerTodo();
		estado = 'transcribiendo';
		mensaje = 'Muse Voice is transcribing what you said…';
		try {
			const wav = await aWav16k(new Blob(trozos, { type: grabadora?.mimeType }));
			const respuesta = await fetch(resolve('/api/voz'), {
				method: 'POST',
				headers: { 'content-type': 'audio/wav' },
				body: wav
			});
			const datos = (await respuesta.json()) as { texto?: string; error?: string };
			if (!respuesta.ok || !datos.texto) throw new Error(datos.error ?? `HTTP ${respuesta.status}`);
			alTranscribir(datos.texto);
			mensaje = 'Done. Check the question in the box and press Ask.';
		} catch (fallo) {
			mensaje = '';
			error =
				fallo instanceof Error && !fallo.message.startsWith('HTTP')
					? fallo.message
					: 'The recording could not be transcribed. You can type the question.';
		} finally {
			estado = 'listo';
		}
	}

	/** Decodifica la grabación y la remuestrea a PCM mono de 16 bits a 16 kHz, con cabecera WAV. */
	async function aWav16k(grabacion: Blob): Promise<Blob> {
		const contexto = new AudioContext();
		const audio = await contexto.decodeAudioData(await grabacion.arrayBuffer());
		await contexto.close();
		const segundos = Math.min(audio.duration, MAXIMO);
		const fuera = new OfflineAudioContext(1, Math.ceil(segundos * 16_000), 16_000);
		const fuente = fuera.createBufferSource();
		fuente.buffer = audio;
		fuente.connect(fuera.destination);
		fuente.start();
		const muestras = (await fuera.startRendering()).getChannelData(0);

		const datos = new DataView(new ArrayBuffer(44 + muestras.length * 2));
		const texto = (pos: number, t: string) =>
			[...t].forEach((c, i) => datos.setUint8(pos + i, c.charCodeAt(0)));
		texto(0, 'RIFF');
		datos.setUint32(4, 36 + muestras.length * 2, true);
		texto(8, 'WAVE');
		texto(12, 'fmt ');
		datos.setUint32(16, 16, true);
		datos.setUint16(20, 1, true);
		datos.setUint16(22, 1, true);
		datos.setUint32(24, 16_000, true);
		datos.setUint32(28, 32_000, true);
		datos.setUint16(32, 2, true);
		datos.setUint16(34, 16, true);
		texto(36, 'data');
		datos.setUint32(40, muestras.length * 2, true);
		muestras.forEach((m, i) =>
			datos.setInt16(44 + i * 2, Math.max(-1, Math.min(1, m)) * 0x7fff, true)
		);
		return new Blob([datos.buffer], { type: 'audio/wav' });
	}
</script>

{#if disponible}
	<div class="dictar">
		<button
			type="button"
			class="secundario"
			class:grabando={estado === 'grabando'}
			aria-pressed={estado === 'grabando'}
			disabled={estado === 'transcribiendo'}
			onclick={alternar}
		>
			<svg viewBox="0 0 20 20" aria-hidden="true"
				><rect x="7" y="2.5" width="6" height="10" rx="3" /><path
					d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"
				/></svg
			>
			{estado === 'grabando'
				? `Stop (${restantes} s)`
				: estado === 'transcribiendo'
					? 'Transcribing…'
					: 'Ask by voice'}
		</button>
		<p class="estado" role="status">{mensaje}</p>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</div>
{/if}

<style>
	.dictar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--e-2) var(--e-3);
		margin-top: var(--e-3);
		font-family: var(--letra-interfaz);
	}

	svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	/* Grabando: el carmín dice que el micrófono está abierto; el texto del botón también. */
	.grabando {
		border-color: var(--rubrica);
		color: var(--rubrica);
	}

	.estado,
	.error {
		margin: 0;
		font-size: var(--t-0);
		color: var(--suave);
	}

	.error {
		color: var(--tinta);
	}

	@media (prefers-reduced-motion: no-preference) {
		.grabando svg {
			animation: latir 1.2s ease-in-out infinite;
		}
		@keyframes latir {
			50% {
				opacity: 0.4;
			}
		}
	}
</style>
