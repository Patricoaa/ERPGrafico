import type { BadgeIntent } from "@/lib/badge-resolvers"

/** Prefijo de todas las queries del cuadre fiscal (TUU, RCV y reporte del período). */
export const FISCAL_RECONCILIATION_KEY = ["fiscal-reconciliation"] as const

/** Estado de cuadre fiscal de un registro externo (TUU / RCV). `""` = no evaluado. */
export type MatchStatus =
    | "MATCHED"
    | "AMOUNT_DIFF"
    | "TYPE_DIFF"
    | "AMBIGUOUS"
    | "ONLY_EXTERNAL"
    | "ONLY_ERP"
    | "EXCLUDED"
    | ""

type EvaluatedStatus = Exclude<MatchStatus, "">

export const MATCH_STATUS_LABELS: Record<EvaluatedStatus, string> = {
    MATCHED: "Cuadrado",
    AMOUNT_DIFF: "Diferencia de monto",
    TYPE_DIFF: "Diferencia de tipo",
    AMBIGUOUS: "Ambiguo",
    ONLY_EXTERNAL: "Falta en el ERP",
    ONLY_ERP: "Falta en el SII/TUU",
    EXCLUDED: "Excluido",
}

export const MATCH_STATUS_INTENTS: Record<EvaluatedStatus, BadgeIntent> = {
    MATCHED: "success",
    AMOUNT_DIFF: "warning",
    TYPE_DIFF: "warning",
    AMBIGUOUS: "warning",
    ONLY_EXTERNAL: "destructive",
    ONLY_ERP: "destructive",
    EXCLUDED: "neutral",
}

/** Valor de `StatusBadge`/`f.status` para un cuadre; prefiere el texto del backend. `""` = «Sin evaluar». */
export function matchStatusValue(
    status: MatchStatus,
    display?: string | null,
): { status: string; label: string; intent: BadgeIntent } {
    if (status === "") return { status: "unevaluated", label: "Sin evaluar", intent: "neutral" }
    return { status: status.toLowerCase(), label: display || MATCH_STATUS_LABELS[status], intent: MATCH_STATUS_INTENTS[status] }
}
