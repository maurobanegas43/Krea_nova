/**
 * Formateadores numéricos y de moneda con configuración regional es-AR
 * Unifica separadores: miles con punto (.) y decimales con coma (,)
 */

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

export function formatUSD(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'USD 0';
  }

  return `USD ${formatNumber(value, options)}`;
}

export function formatPercent(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0 %';
  }

  return `${formatNumber(value, { maximumFractionDigits: 1, ...options })} %`;
}
