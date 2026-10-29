/**
 * Consulta del enlace «Save to investigation» de una cita, para `/investigations/save`. Sin
 * JavaScript esa página guarda la cita; con JavaScript, el layout intercepta el enlace y abre el
 * diálogo con los mismos datos.
 */
export function consultaGuardar(fragmentoId: number, frase = ''): string {
	const parametros = new URLSearchParams({ f: String(fragmentoId) });
	if (frase) parametros.set('q', frase);
	return `?${parametros}`;
}

export interface CitaPorGuardar {
	fragmentoId: number;
	frase: string;
	/** Video y minuto, para que la persona sepa qué está guardando. */
	etiqueta: string;
}
