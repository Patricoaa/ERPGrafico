/**
 * Formats a number in Spanish compact notation for chart axis ticks.
 * - <1000 → "500"
 * - 1K–999K → "1 m", "100 m"
 * - 1M–999M → "1 M", "500 M"
 * - 1B+ → "1 MM", "10 MM"
 * If currency=true, prepends "$" → "$1 m", "$1 M"
 */
export function formatCompactSpanish(value: number, currency?: boolean): string {
    const abs = Math.abs(value)
    const sign = value < 0 ? "-" : ""
    const prefix = currency ? "$" : ""

    if (abs >= 1_000_000_000) {
        const n = abs / 1_000_000_000
        const formatted = n === Math.floor(n) ? `${n}` : n.toFixed(1).replace(/\.0$/, "")
        return `${sign}${prefix}${formatted} MM`
    }
    if (abs >= 1_000_000) {
        const n = abs / 1_000_000
        const formatted = n === Math.floor(n) ? `${n}` : n.toFixed(1).replace(/\.0$/, "")
        return `${sign}${prefix}${formatted} M`
    }
    if (abs >= 1_000) {
        const n = abs / 1_000
        const formatted = n === Math.floor(n) ? `${n}` : n.toFixed(1).replace(/\.0$/, "")
        return `${sign}${prefix}${formatted} m`
    }
    return `${sign}${prefix}${abs}`
}
