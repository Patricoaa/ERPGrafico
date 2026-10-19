import { formatMoney, formatQuantity } from "@/lib/money"
import { EMPTY_VALUE, formatPlainDate, isMissing, translateStatus } from "@/lib/utils"

export { isMissing }
import type { CurrencyCode, DecimalString, FlowDirection, ISODate, StatusValue } from "./value-kinds"

/**
 * Pure formatters (ADR-0087 §2, P1). Single source for table, card, subtitle,
 * accessible text and export. Missing data renders as `EMPTY`.
 */
export const EMPTY = EMPTY_VALUE

type Numeric = number | DecimalString | null | undefined

export function toNumber(value: Numeric): number | null {
    if (value === null || value === undefined || value === "") return null
    const n = typeof value === "number" ? value : Number(value)
    return Number.isFinite(n) ? n : null
}


export function formatText(value: string | number | null | undefined, prefix = ""): string {
    return isMissing(value) ? EMPTY : `${prefix}${String(value)}`
}

export function formatNumber(value: Numeric, decimals = 0, suffix?: string): string {
    const n = toNumber(value)
    if (n === null) return EMPTY
    const base = formatQuantity(n, decimals)
    return suffix ? `${base} ${suffix}` : base
}

export function formatMoneyValue(value: Numeric, currency: CurrencyCode = "CLP", sign: "auto" | "always" | "never" = "auto"): string {
    const n = toNumber(value)
    if (n === null) return EMPTY
    if (sign === "never") return formatMoney(Math.abs(n), currency)
    if (sign === "always" && n > 0) return `+${formatMoney(n, currency)}`
    return formatMoney(n, currency)
}

export function formatFlow(value: Numeric, direction: FlowDirection, currency: CurrencyCode = "CLP"): string {
    const n = toNumber(value)
    if (n === null) return EMPTY
    const abs = formatMoney(Math.abs(n), currency)
    if (direction === "inflow") return `+${abs}`
    if (direction === "outflow") return `−${abs}`
    return abs
}

/** Date or datetime. Datetime uses local time (`HH:mm`); date-only never shifts timezone. */
export function formatDate(value: ISODate | null | undefined, time = false): string {
    if (isMissing(value) || !value) return EMPTY
    const date = formatPlainDate(value)
    if (!time || !value.includes("T")) return date
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return date
    // Same time format as DataCell.Date showTime (es-CL, 2-digit), so text and cell agree.
    return `${date} ${TIME_FORMAT.format(d)}`
}

const TIME_FORMAT = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" })

/** Just the `HH:mm` of a datetime value — for a separate audit-trail timestamp shown next to an unrelated business date (e.g. `ledgerDate`). */
export function formatTimeOfDay(value: string | null | undefined): string {
    if (isMissing(value) || !value) return EMPTY
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? EMPTY : TIME_FORMAT.format(d)
}

export function formatDateRange(range: { from: ISODate; to: ISODate | null } | null): string {
    if (!range) return EMPTY
    if (!range.to || range.to === range.from) return formatDate(range.from)
    return `${formatDate(range.from)} – ${formatDate(range.to)}`
}

export function formatStatus(value: StatusValue | null): string {
    if (!value) return EMPTY
    return value.label ?? translateStatus(value.status)
}

export function formatProgress(value: { done: number; total: number } | null, format: "percent" | "ratio" = "percent"): string {
    if (!value) return EMPTY
    if (format === "ratio") return `${formatQuantity(value.done)}/${formatQuantity(value.total)}`
    if (value.total <= 0) return EMPTY
    return `${Math.round((value.done / value.total) * 100)} %`
}

export function formatTags(value: readonly string[] | null): string {
    return !value || value.length === 0 ? EMPTY : value.join(", ")
}
