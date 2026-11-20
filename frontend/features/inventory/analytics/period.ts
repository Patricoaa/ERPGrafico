import { monthsAgoIso } from "./monthsAgoIso"

/** Período del análisis de producto. `all` = histórico completo (sin `date_from`). */
export type PeriodKey = "1m" | "3m" | "6m" | "12m" | "24m" | "all"

export const DEFAULT_PERIOD: PeriodKey = "12m"

export const PERIOD_OPTIONS: ReadonlyArray<{ value: PeriodKey; label: string }> = [
    { value: "1m", label: "1 m" },
    { value: "3m", label: "3 m" },
    { value: "6m", label: "6 m" },
    { value: "12m", label: "12 m" },
    { value: "24m", label: "24 m" },
    { value: "all", label: "Histórico" },
]

/** `date_from` ISO del período, o `undefined` para el histórico. */
export function periodToDateFrom(period: PeriodKey, today = new Date()): string | undefined {
    if (period === "all") return undefined
    return monthsAgoIso(parseInt(period, 10), today)
}
