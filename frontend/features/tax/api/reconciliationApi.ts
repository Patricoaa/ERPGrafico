import api from '@/lib/api'
import type { MatchStatus, TerminalCandidate } from '../types/reconciliation'

export interface TerminalMatchResult {
    id: number
    match_status: MatchStatus
    matched_invoice: number | null
}

export const reconciliationApi = {
    getTerminalSaleCandidates: (saleId: number) =>
        api.get<TerminalCandidate[]>(`/tax/reconciliation/terminal-sales/${saleId}/candidates/`).then(r => r.data),
    matchTerminalSale: (saleId: number, invoiceId: number) =>
        api.post<TerminalMatchResult>(`/tax/reconciliation/terminal-sales/${saleId}/match/`, { invoice_id: invoiceId }).then(r => r.data),
    unmatchTerminalSale: (saleId: number) =>
        api.post<TerminalMatchResult>(`/tax/reconciliation/terminal-sales/${saleId}/unmatch/`).then(r => r.data),
}
