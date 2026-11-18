import api from '@/lib/api'
import type {
    FiscalReconciliationReport,
    RcvDocumentCandidate,
    RcvMatchResult,
    RcvPurchaseOrderOption,
    ReconciliationRunParams,
} from '../types/reconciliation'

export const reconciliationApi = {
    getReport: (year: number, month: number) =>
        api.get<FiscalReconciliationReport>('/tax/reconciliation/', { params: { year, month } }).then(r => r.data),
    /** Recalcula el cuadre del período; la respuesta es un conteo por estado que la UI no lee. */
    run: ({ source, year, month }: ReconciliationRunParams) =>
        api.post<unknown>(`/tax/reconciliation/${source}/run/`, { year, month }).then(r => r.data),
    /** Borradores de compra del mismo RUT con total parecido (≤ 2 %). */
    getRcvDraftSuggestions: (docId: number) =>
        api.get<RcvDocumentCandidate[]>(`/tax/reconciliation/rcv-documents/${docId}/draft-suggestions/`).then(r => r.data),
    getRcvPurchaseOrders: (docId: number) =>
        api.get<RcvPurchaseOrderOption[]>(`/tax/reconciliation/rcv-documents/${docId}/purchase-orders/`).then(r => r.data),
    /** Asigna folio y fecha del RCV al borrador y lo emite. `Idempotency-Key` obligatoria. */
    confirmRcvDraft: (docId: number, invoiceId: number, idempotencyKey: string) =>
        api.post<RcvMatchResult>(
            `/tax/reconciliation/rcv-documents/${docId}/confirm-draft/`,
            { invoice_id: invoiceId },
            { headers: { 'Idempotency-Key': idempotencyKey } },
        ).then(r => r.data),
    /** Crea un borrador de compra desde la OC, ya vinculado. `Idempotency-Key` obligatoria. */
    createRcvDraft: (docId: number, purchaseOrderId: number, idempotencyKey: string) =>
        api.post<RcvMatchResult>(
            `/tax/reconciliation/rcv-documents/${docId}/create-draft/`,
            { purchase_order_id: purchaseOrderId },
            { headers: { 'Idempotency-Key': idempotencyKey } },
        ).then(r => r.data),
}
