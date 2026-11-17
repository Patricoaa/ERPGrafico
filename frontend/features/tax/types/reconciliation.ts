import type { MatchStatus } from '@/lib/fiscal-match'

export type { MatchStatus }

/**
 * Espejo de `/api/tax/reconciliation/*` (ADR-0138). Los montos llegan como string Decimal
 * con escala variable (`"0"`, `"3000.00"`).
 */

/** Conteo por estado. Solo vienen las claves presentes, más `ONLY_ERP`; `""` = no evaluado. */
export type MatchCounts = Partial<Record<MatchStatus, number>>

/**
 * Conteos de facturas y notas frente al RCV. `ONLY_ERP` es null si no hay importación RCV
 * exitosa de esa dirección en el período: sin RCV no se sabe qué falta en el SII.
 */
export type DocumentMatchCounts = Omit<MatchCounts, 'ONLY_ERP'> & { ONLY_ERP?: number | null }

/** Resumen mensual de boletas y comprobantes (39, 41, 48). `rcv_*`/`difference` son null sin importación RCV de ventas. */
export interface ReconciliationSummary {
    dte_type: number
    erp_count: number
    erp_total: string
    tuu_count: number
    tuu_total: string
    rcv_count: number | null
    rcv_total: string | null
    /** `erp_total - rcv_total` */
    difference: string | null
    /** Ventas TUU 39/41 del mes sin boleta en el RCV (ADR-0139); null para el 48. */
    tuu_without_rcv: number | null
    /** Boletas RCV 39/41 del período sin venta TUU (`ONLY_EXTERNAL`); null para el 48. */
    rcv_without_tuu: number | null
}

/** Factura o nota del ERP sin documento en el RCV. */
export interface OnlyErpDocument {
    id: number
    label: string
    amount: string
    /** ISO date */
    date: string
}

/**
 * Motivo por el que un borrador 39/41/48 sin folio aún no se emite (ADR-0140):
 * sin venta TUU cuadrada, boleta sin su folio del RCV, error del último intento o lista para la próxima emisión.
 */
export type PendingIssueReason = 'NO_TUU' | 'WAITING_RCV' | 'ERROR' | 'READY'

/** Borrador de boleta o comprobante a la espera de su número fiscal. */
export interface PendingIssueDocument extends OnlyErpDocument {
    reason: PendingIssueReason
    /** Texto del error del último intento; solo con `reason === 'ERROR'`. */
    error: string | null
}

export interface FiscalReconciliationReport {
    /** Fecha desde la que se cuadra (`fiscal_match_start_date`); null si no está configurada. */
    start_date: string | null
    documents: { purchase: DocumentMatchCounts; sale: DocumentMatchCounts }
    only_erp: OnlyErpDocument[]
    summaries: ReconciliationSummary[]
    terminal: MatchCounts
    /** Borradores 39/41/48 sin folio del mes; `items` trae como máximo 50. */
    pending_issue: { count: number; items: PendingIssueDocument[] }
}

export type ReconciliationSource = 'rcv' | 'terminal'

export interface ReconciliationRunParams {
    source: ReconciliationSource
    year: number
    month: number
}

/** Factura local candidata a vincularse con un documento RCV. */
export interface RcvDocumentCandidate {
    id: number
    display_id: string
    dte_type: string
    total: string
    /** ISO date */
    date: string
}

export interface RcvMatchResult {
    id: number
    match_status: MatchStatus
    matched_invoice: number | null
}

/** OC no anulada del proveedor de un documento RCV de compras (para crear un borrador). */
export interface RcvPurchaseOrderOption {
    id: number
    display_id: string
    /** ISO date */
    date: string
    total: string
}
