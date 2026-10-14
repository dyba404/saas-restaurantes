/**
 * Localización del producto: Perú (es-PE / PEN).
 * Fuente única para formateo de moneda, locale y zona horaria en todas las apps.
 */

export const LOCALE = "es-PE" as const;
export const CURRENCY = "PEN" as const;
export const TIMEZONE = "America/Lima" as const;

/** Código de país por defecto para teléfonos (Perú, +51). */
export const DEFAULT_COUNTRY_CODE = "+51" as const;

/**
 * Formatea centavos a soles peruanos: formatMoneyCents(1250) → "S/ 12.50".
 * Intl para es-PE/PEN produce "S/ 12.50" (símbolo "S/" con espacio).
 */
export function formatMoneyCents(cents: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
