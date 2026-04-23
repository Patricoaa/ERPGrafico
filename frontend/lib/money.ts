/**
 * Formats a monetary amount as a localized currency string.
 * Use this ONLY in non-JSX contexts (template literals, state messages).
 * For rendering in JSX, always use <MoneyDisplay /> instead.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency = 'CLP',
  options?: Intl.NumberFormatOptions
): string {
  const n = Number(amount)
  if (isNaN(n) || amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    ...options,
  }).format(n)
}
