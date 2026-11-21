// Espejo de backend/accounting/vat.py (ADR-0151). Sin tasa por defecto: el
// multiplicador siempre es explícito (useVatRate().multiplier).
// Paridad verificada con shared/vat-rounding-cases.json.

const SCALE = 1_000_000

/** Redondeo half-up exacto de num/den (enteros no negativos), sin floats intermedios. */
function divRoundHalfUp(num: number, den: number): number {
    return Math.floor((2 * num + den) / (2 * den))
}

const scaled = (multiplier: number): number => Math.round(multiplier * SCALE)

const isExactPeso = (value: number): boolean => Number.isInteger(value) && value >= 0

export const grossFromNet = (net: number, multiplier: number): number => {
    if (!isExactPeso(net)) return Math.round(net * multiplier)
    return divRoundHalfUp(net * scaled(multiplier), SCALE)
}

export const netFromGross = (gross: number, multiplier: number): number => {
    if (!isExactPeso(gross)) return Math.round(gross / multiplier)
    return divRoundHalfUp(gross * SCALE, scaled(multiplier))
}

export const salePriceFromGross = (gross: number, multiplier: number) => {
    const g = Math.round(gross)
    return { gross: g, net: netFromGross(g, multiplier) }
}
