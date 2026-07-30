/**
 * Chart color palette — single source of truth.
 *
 * Colors are read at runtime from the CSS custom properties defined in globals.css
 * (--chart-1 … --chart-8), so they automatically follow the active theme (light/dark).
 *
 * Order follows the CMYK convention established in globals.css:
 *   1 cyan · 2 magenta · 3 yellow · 4 black · 5 pantone-orange · 6 pantone-violet · 7 green · 8 blue
 *
 * SSR fallbacks are hex approximations of the oklch values in globals.css so that
 * server-rendered charts are visually consistent on first paint.
 *
 * Usage:
 *   import { getChartPalette, assignChartColors } from "@/lib/chart-colors"
 *
 *   // Get full palette
 *   const colors = getChartPalette()
 *
 *   // Assign palette colors to an array of items by index
 *   const data = assignChartColors(myItems)   // adds .color to each item
 */

/** Hex approximations of the 8 chart tokens for SSR / environments without window */
const SSR_FALLBACKS = [
    "#00b0d8", // cyan       oklch(0.65 0.18 235)
    "#d4007c", // magenta    oklch(0.55 0.28 340)
    "#f5d200", // yellow     oklch(0.90 0.18  95)
    "#262420", // black      oklch(0.15 0.01  60)
    "#e8810a", // p-orange   oklch(0.72 0.18  55)
    "#8b2fbf", // p-violet   oklch(0.50 0.22 300)
    "#00a862", // green      oklch(0.65 0.18 145)
    "#4433c8", // blue       oklch(0.45 0.22 280)
] as const

const CHART_VARS = [
    "--chart-1",
    "--chart-2",
    "--chart-3",
    "--chart-4",
    "--chart-5",
    "--chart-6",
    "--chart-7",
    "--chart-8",
] as const

/**
 * Returns the chart palette as an array of color strings.
 * In the browser these are the resolved CSS custom-property values (oklch or hex).
 * On the server the SSR hex fallbacks are returned.
 */
export function getChartPalette(): string[] {
    if (typeof window === "undefined") return [...SSR_FALLBACKS]
    const style = getComputedStyle(document.documentElement)
    return CHART_VARS.map((v, i) => style.getPropertyValue(v).trim() || SSR_FALLBACKS[i])
}

/**
 * Assigns a `color` property to each item in the array based on its index in the palette.
 * Items that already have a `color` property keep their value.
 *
 * @param items  Array of objects (must be serialisable — no mutation of originals)
 * @returns      New array with `color` added/preserved on each item
 */
export function assignChartColors<T extends object>(items: T[]): (T & { color: string })[] {
    const palette = getChartPalette()
    return items.map((item, i) => ({
        ...item,
        color: (item as Record<string, unknown>).color as string ?? palette[i % palette.length],
    }))
}

/**
 * Returns a single palette color by index (wraps around if index exceeds palette length).
 */
export function chartColor(index: number): string {
    const palette = getChartPalette()
    return palette[index % palette.length]
}
