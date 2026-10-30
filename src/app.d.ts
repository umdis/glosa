// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** Llegó a `/ask?q=` con un clic en «Ask» de la portada: la pregunta empieza sola. */
			preguntar?: boolean;
		}
		// interface Platform {}
	}
}

export {};
