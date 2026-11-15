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

/** Factura local candidata a vincularse con una venta TUU. */
export interface TerminalCandidate {
    id: number
    display_id: string
    dte_type: string
    total: string
    /** ISO date */
    date: string
}
