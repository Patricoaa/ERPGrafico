import type { BadgeIntent } from "@/lib/badge-resolvers"

/** Prefijo de todas las queries del cuadre por grupo (`/api/tax/fiscal-matches/`). */
export const FISCAL_MATCH_KEY = ["fiscal-match"] as const

/** Estado de una parte (ERP, TUU, RCV) dentro de un grupo. */
export type PartState = "MATCHED" | "PENDING" | "MISSING" | "DIFF" | "AMBIGUOUS" | "NOT_APPLICABLE" | "SUMMARY_ONLY"

/** Estado agregado de un grupo de cuadre. */
export type FiscalMatchStatus =
    | "MATCHED"
    | "PENDING"
    | "DIFF"
    | "AMBIGUOUS"
    | "MISSING_ERP"
    | "MISSING_EXTERNAL"
    | "EXCLUDED"

export const PART_STATE_LABELS: Record<PartState, string> = {
    MATCHED: "Cuadrado",
    PENDING: "Pendiente",
    MISSING: "Falta",
    DIFF: "Diferencia",
    AMBIGUOUS: "Ambiguo",
    NOT_APPLICABLE: "No aplica",
    SUMMARY_ONLY: "Solo resumen",
}

export const FISCAL_MATCH_STATUS_LABELS: Record<FiscalMatchStatus, string> = {
    MATCHED: "Cuadrado",
    PENDING: "Pendiente",
    DIFF: "Con diferencia",
    AMBIGUOUS: "Ambiguo",
    MISSING_ERP: "Falta en el ERP",
    MISSING_EXTERNAL: "Falta en SII/TUU",
    EXCLUDED: "Excluido",
}

export const PART_STATE_INTENTS: Record<PartState, BadgeIntent> = {
    MATCHED: "success",
    PENDING: "neutral",
    MISSING: "destructive",
    DIFF: "warning",
    AMBIGUOUS: "warning",
    NOT_APPLICABLE: "neutral",
    SUMMARY_ONLY: "neutral",
}

export const FISCAL_MATCH_STATUS_INTENTS: Record<FiscalMatchStatus, BadgeIntent> = {
    MATCHED: "success",
    PENDING: "neutral",
    DIFF: "warning",
    AMBIGUOUS: "warning",
    MISSING_ERP: "destructive",
    MISSING_EXTERNAL: "destructive",
    EXCLUDED: "neutral",
}

/** Valor de `StatusBadge` para el estado de un grupo; prefiere el texto del backend. */
export function fiscalMatchStatusValue(
    status: FiscalMatchStatus,
    display?: string | null,
): { status: string; label: string; intent: BadgeIntent } {
    return {
        status: status.toLowerCase(),
        label: display || FISCAL_MATCH_STATUS_LABELS[status],
        intent: FISCAL_MATCH_STATUS_INTENTS[status],
    }
}

/** Valor de `StatusBadge` para el estado de una parte del grupo. */
export function partStateValue(state: PartState): { status: string; label: string; intent: BadgeIntent } {
    return { status: state.toLowerCase(), label: PART_STATE_LABELS[state], intent: PART_STATE_INTENTS[state] }
}

/** Estados del grupo en el orden de los filtros. */
export const FISCAL_MATCH_STATUS_VALUES: readonly FiscalMatchStatus[] = [
    "MATCHED",
    "PENDING",
    "DIFF",
    "AMBIGUOUS",
    "MISSING_ERP",
    "MISSING_EXTERNAL",
    "EXCLUDED",
]

/** Opciones del filtro «Cuadre» de las listas TUU y RCV (`fiscal_match_status`). */
export const FISCAL_MATCH_STATUS_OPTIONS = FISCAL_MATCH_STATUS_VALUES.map((value) => ({
    label: FISCAL_MATCH_STATUS_LABELS[value],
    value,
}))

export const isFiscalMatchStatus = (v: string | undefined): v is FiscalMatchStatus =>
    !!v && (FISCAL_MATCH_STATUS_VALUES as readonly string[]).includes(v)

/** Referencia al grupo de cuadre que devuelven las listas y fichas de TUU y RCV. */
export interface FiscalMatchRef {
    id: number
    status: FiscalMatchStatus
    status_display: string
}

/** Valor de `StatusBadge` para el grupo de un registro; `null` = sin grupo (no evaluado). */
export function fiscalMatchRefValue(
    ref: FiscalMatchRef | null,
): { status: string; label: string; intent: BadgeIntent } {
    if (ref === null) return { status: "unevaluated", label: "Sin evaluar", intent: "neutral" }
    return fiscalMatchStatusValue(ref.status, ref.status_display)
}

const pad2 = (n: number) => String(n).padStart(2, "0")

/**
 * Enlace «Ir al cuadre»: lo que requiere atención del mes (primer a último día), en ventas y
 * compras (`direction=all`), como el conteo del F29 y del cierre. El conteo agrupa por
 * `fiscal_period` y el enlace filtra por fecha de emisión: pueden diferir en algún registro RCV.
 */
export function cuadreAttentionHref(year: number, month: number): string {
    const last = new Date(year, month, 0).getDate()
    const from = `${year}-${pad2(month)}-01`
    const to = `${year}-${pad2(month)}-${pad2(last)}`
    return `/accounting/rcv/cuadre?direction=all&status=attention&date_from=${from}&date_to=${to}`
}
