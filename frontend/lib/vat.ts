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

export interface VatRoundingOptions {
    /** Decimales del resultado (compras con netos de 2 decimales). Por defecto 0 (pesos enteros). */
    decimals?: number
}

/** Mismo método exacto, escalando la entrada por 10^decimals para no usar floats en el redondeo. */
const convert = (
    value: number,
    multiplier: number,
    direction: "up" | "down",
    decimals: number,
): number => {
    const unit = 10 ** decimals
    const x = Math.round(value * unit)
    if (!Number.isFinite(x) || x < 0) {
        const raw = direction === "up" ? value * multiplier : value / multiplier
        return Math.round(raw * unit) / unit
    }
    const out =
        direction === "up"
            ? divRoundHalfUp(x * scaled(multiplier), SCALE)
            : divRoundHalfUp(x * SCALE, scaled(multiplier))
    return out / unit
}

export const grossFromNet = (net: number, multiplier: number, options?: VatRoundingOptions): number => {
    const decimals = options?.decimals ?? 0
    if (decimals === 0) {
        if (!isExactPeso(net)) return Math.round(net * multiplier)
        return divRoundHalfUp(net * scaled(multiplier), SCALE)
    }
    return convert(net, multiplier, "up", decimals)
}

export const netFromGross = (gross: number, multiplier: number, options?: VatRoundingOptions): number => {
    const decimals = options?.decimals ?? 0
    if (decimals === 0) {
        if (!isExactPeso(gross)) return Math.round(gross / multiplier)
        return divRoundHalfUp(gross * SCALE, scaled(multiplier))
    }
    return convert(gross, multiplier, "down", decimals)
}

export const salePriceFromGross = (gross: number, multiplier: number) => {
    const g = Math.round(gross)
    return { gross: g, net: netFromGross(g, multiplier) }
}
