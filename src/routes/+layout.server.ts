import { SHOW_FRAMES } from '$app/env/private';
import type { LayoutServerLoad } from './$types';

/** Lo que todas las páginas necesitan saber del servidor. */
export const load: LayoutServerLoad = () => ({ fotogramas: SHOW_FRAMES });
