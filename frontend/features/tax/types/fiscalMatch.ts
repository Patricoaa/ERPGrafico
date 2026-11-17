import type { FiscalMatchStatus, PartState } from '@/lib/fiscal-match'

export type { FiscalMatchStatus, PartState }

/**
 * Espejo de `/api/tax/fiscal-matches/` (backend `tax/fiscal_match/serializers.py`). Los montos
 * llegan como string Decimal; las fechas como ISO.
 */

export type FiscalMatchDirection = 'SALE' | 'PURCHASE'
export type FiscalMatchPart = 'erp' | 'tuu' | 'rcv'
/** Filtro especial de `status`: grupos que requieren atención. */
export type FiscalMatchStatusFilter = FiscalMatchStatus | 'attention'

export interface FiscalMatchFilters {
    direction?: FiscalMatchDirection
    status?: FiscalMatchStatusFilter[]
    dte_type?: number
    date_from?: string
    date_to?: string
    search?: string
}

export interface FiscalMatchInvoiceRef {
    id: number
    display_id: string
}

export interface FiscalMatchSaleRef {
    id: number
    transaction_at: string
    sale_amount: string
}

export interface FiscalMatchRcvRef {
    id: number
    folio: string
}

export interface FiscalMatchListItem {
    id: number
    direction: FiscalMatchDirection
    status: FiscalMatchStatus
    status_display: string
    erp_state: PartState
    tuu_state: PartState
    rcv_state: PartState
    dte_type: number | null
    issue_date: string | null
    erp_amount: string | null
    tuu_amount: string | null
    rcv_amount: string | null
    invoice: FiscalMatchInvoiceRef | null
    terminal_sales: FiscalMatchSaleRef[]
    rcv_documents: FiscalMatchRcvRef[]
    notice: string
    closed_period_alert: boolean
    issue_error: string
}

export interface FiscalMatchMovementRef {
    id: number
    amount: string
    created_at: string
}

export interface FiscalMatchInvoiceDetail extends FiscalMatchInvoiceRef {
    dte_type: string
    number: string
    status: string
    total: string | null
    date: string | null
}

export interface FiscalMatchSaleDetail extends FiscalMatchSaleRef {
    document_type: number | null
    payment_type: string
    matched_movement: FiscalMatchMovementRef | null
    linked_manually: boolean
}

export interface FiscalMatchRcvDetail extends FiscalMatchRcvRef {
    dte_type: number
    issue_date: string | null
    total_amount: string
    period: string
}

export interface FiscalMatchDetail extends Omit<FiscalMatchListItem, 'invoice' | 'terminal_sales' | 'rcv_documents'> {
    invoice: FiscalMatchInvoiceDetail | null
    terminal_sales: FiscalMatchSaleDetail[]
    rcv_documents: FiscalMatchRcvDetail[]
    counterparty_rut: string
    fiscal_period: string
    rcv_linked_manually: boolean
    issue_attempted_at: string | null
    evaluated_at: string | null
}

export interface FiscalMatchCounts {
    by_status: Record<FiscalMatchStatus, number>
    last_run_at: string | null
}

export interface ErpCandidate {
    id: number
    display_id: string
    dte_type: string
    number: string
    total: string | null
    date: string | null
}

export interface TuuCandidate extends FiscalMatchSaleRef {
    document_type: number | null
    payment_type: string
    compatible_movements: number[]
}

export interface RcvCandidate extends FiscalMatchRcvDetail {
    counterparty_rut: string
}

export interface FiscalMatchCandidateMap {
    erp: ErpCandidate
    tuu: TuuCandidate
    rcv: RcvCandidate
}

export type FiscalMatchCandidate = FiscalMatchCandidateMap[FiscalMatchPart]

export interface FiscalMatchLinkBody {
    part: FiscalMatchPart
    id: number
    /** Movimiento de tesorería a asociar (solo `tuu`). */
    movement?: number | null
}

export interface FiscalMatchUnlinkBody {
    part: 'tuu' | 'rcv'
    id: number
}

/** Fila del resumen mensual de boletas y comprobantes (39, 41, 48). `rcv_*`/`difference` son null sin importación RCV de ventas. */
export interface MonthlySummaryRow {
    dte_type: number
    erp_count: number
    erp_total: string
    tuu_count: number
    tuu_total: string
    /** ERP más, en el 48, las ventas con tarjeta de facturas. */
    expected_total: string
    rcv_count: number | null
    rcv_total: string | null
    difference: string | null
}

export type PendingIssueReason = 'ERROR' | 'NO_TUU' | 'MANY_FOLIOS' | 'WAITING_RCV' | 'READY'

export interface PendingIssueItem {
    /** Id de la factura borrador. */
    id: number
    /** Id del grupo de cuadre. */
    group: number
    label: string
    amount: string | null
    date: string | null
    reason: PendingIssueReason
    error: string | null
}

export interface PendingIssue {
    count: number
    items: PendingIssueItem[]
}
