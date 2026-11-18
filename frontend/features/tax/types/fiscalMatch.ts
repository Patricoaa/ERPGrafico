import type { FiscalMatchStatus, PartState } from '@/lib/fiscal-match'

export type { FiscalMatchStatus, PartState }

/**
 * Espejo de `/api/tax/fiscal-matches/` (backend `tax/fiscal_match/serializers.py`). Los montos
 * llegan como string Decimal; las fechas como ISO.
 */

export type FiscalMatchDirection = 'sale' | 'purchase'
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
    /** `RCVSettings.fiscal_match_start_date`; null = sin configurar (el motor no evalúa nada). */
    start_date: string | null
}

/** Cobro del documento al que puede corresponder una venta TUU. */
export interface CandidateMovement extends FiscalMatchMovementRef {
    /** Nombre del método de pago («Tarjeta», «Efectivo»). */
    method: string
}

export type FiscalMatchSearchOrdering = 'score' | 'recent'

export interface FiscalMatchSearchParams {
    q?: string
    ordering?: FiscalMatchSearchOrdering
}

export interface FiscalMatchWarning {
    code: string
    label: string
    /** Un aviso bloqueante impide cuadrar la tarjeta. */
    blocking: boolean
}

/** Tarjeta candidata de `GET fiscal-matches/{id}/search/` (opcionales solo en su parte). */
export interface FiscalMatchSearchItem {
    id: number
    kind: string
    label: string
    counterparty: string
    date: string
    datetime?: string
    amount: string
    score: number
    warnings: FiscalMatchWarning[]
    /** ERP/RCV con venta TUU de referencia: cobros libres compatibles. */
    compatible_movements?: CandidateMovement[]
    /** Venta TUU hacia un documento: registros del SII de su grupo huérfano que viajarían con ella. */
    carried_rcv?: { id: number; folio: string }[]
    /** `{sale_id: cobros libres}` para documentos que se cuadran contra varias ventas. */
    payments_by_sale?: Record<string, CandidateMovement[]>
}

/** Cambio en espera de la ficha (`POST fiscal-matches/{id}/apply/`). */
export interface FiscalMatchChange {
    op: 'link' | 'unlink'
    part: FiscalMatchPart
    id: number
    /** Movimiento de tesorería a asociar (link de una venta TUU / documento ERP). */
    movement?: number | null
    /** `{sale_id: movement_id}` */
    payments?: Record<number, number> | null
}

/** Borrador de compra sugerido para un grupo con registro del SII sin factura. */
export interface RcvDocumentCandidate {
    id: number
    display_id: string
    dte_type: string
    total: string
    /** ISO date */
    date: string
}

/** OC no anulada del proveedor del grupo (para crear un borrador). */
export interface RcvPurchaseOrderOption {
    id: number
    display_id: string
    /** ISO date */
    date: string
    total: string
}
