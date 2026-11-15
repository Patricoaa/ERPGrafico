import api from '@/lib/api'
import type {
    FiscalReconciliationReport,
    RcvDocumentCandidate,
    RcvMatchResult,
    ReconciliationRunParams,
} from '../types/reconciliation'

export const reconciliationApi = {
    getReport: (year: number, month: number) =>
        api.get<FiscalReconciliationReport>('/tax/reconciliation/', { params: { year, month } }).then(r => r.data),
    /** Recalcula el cuadre del período; la respuesta es un conteo por estado que la UI no lee. */
    run: ({ source, year, month }: ReconciliationRunParams) =>
        api.post<unknown>(`/tax/reconciliation/${source}/run/`, { year, month }).then(r => r.data),
    getRcvDocumentCandidates: (docId: number) =>
        api.get<RcvDocumentCandidate[]>(`/tax/reconciliation/rcv-documents/${docId}/candidates/`).then(r => r.data),
    matchRcvDocument: (docId: number, invoiceId: number) =>
        api.post<RcvMatchResult>(`/tax/reconciliation/rcv-documents/${docId}/match/`, { invoice_id: invoiceId }).then(r => r.data),
    unmatchRcvDocument: (docId: number) =>
        api.post<RcvMatchResult>(`/tax/reconciliation/rcv-documents/${docId}/unmatch/`).then(r => r.data),
}
