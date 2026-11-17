import api from '@/lib/api'
import { toPage, type Page } from '@/lib/pagination'
import type {
    FiscalMatchCandidateMap,
    FiscalMatchCounts,
    FiscalMatchDetail,
    FiscalMatchFilters,
    FiscalMatchLinkBody,
    FiscalMatchListItem,
    FiscalMatchPart,
    FiscalMatchUnlinkBody,
    MonthlySummaryRow,
    PendingIssue,
} from '../types/fiscalMatch'
import type { RcvDocumentCandidate, RcvPurchaseOrderOption } from '../types/reconciliation'

const BASE = '/tax/fiscal-matches'
export const FISCAL_MATCH_PAGE_SIZE = 50

const idem = (key: string) => ({ headers: { 'Idempotency-Key': key } })

/** `status` viaja como query repetida; el resto de filtros vacíos se omiten. */
function filterParams(filters: FiscalMatchFilters): URLSearchParams {
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue
        if (Array.isArray(value)) value.forEach(v => params.append(name, String(v)))
        else params.append(name, String(value))
    }
    return params
}

/** Cliente de `/api/tax/fiscal-matches/` (cuadre por grupo). Todo POST exige `Idempotency-Key`; 409 = motor ocupado. */
export const fiscalMatchApi = {
    list: async (filters: FiscalMatchFilters, page = 1, signal?: AbortSignal): Promise<Page<FiscalMatchListItem>> => {
        const params = filterParams(filters)
        params.set('page', String(page))
        params.set('page_size', String(FISCAL_MATCH_PAGE_SIZE))
        const response = await api.get(`${BASE}/`, { params, signal })
        return toPage<FiscalMatchListItem>(response.data, page, FISCAL_MATCH_PAGE_SIZE)
    },
    counts: (filters: FiscalMatchFilters) =>
        api.get<FiscalMatchCounts>(`${BASE}/counts/`, { params: filterParams(filters) }).then(r => r.data),
    get: (id: number) => api.get<FiscalMatchDetail>(`${BASE}/${id}/`).then(r => r.data),
    candidates: <P extends FiscalMatchPart>(id: number, part: P) =>
        api.get<FiscalMatchCandidateMap[P][]>(`${BASE}/${id}/candidates/`, { params: { part } }).then(r => r.data),
    link: (id: number, body: FiscalMatchLinkBody, key: string) =>
        api.post<FiscalMatchDetail>(`${BASE}/${id}/link/`, body, idem(key)).then(r => r.data),
    unlink: (id: number, body: FiscalMatchUnlinkBody, key: string) =>
        api.post<FiscalMatchDetail>(`${BASE}/${id}/unlink/`, body, idem(key)).then(r => r.data),
    release: (id: number, key: string) =>
        api.post<FiscalMatchDetail>(`${BASE}/${id}/release/`, {}, idem(key)).then(r => r.data),
    retryIssue: (id: number, key: string) =>
        api.post<FiscalMatchDetail>(`${BASE}/${id}/retry-issue/`, {}, idem(key)).then(r => r.data),
    summary: (year: number, month: number) =>
        api.get<MonthlySummaryRow[]>(`${BASE}/summary/`, { params: { year, month } }).then(r => r.data),
    pendingIssue: (period?: { year: number; month: number }) =>
        api.get<PendingIssue>(`${BASE}/pending-issue/`, { params: period }).then(r => r.data),

    // Alimentación desde el RCV (documento RCV sin factura en el ERP)
    draftSuggestions: (id: number) =>
        api.get<RcvDocumentCandidate[]>(`${BASE}/${id}/draft-suggestions/`).then(r => r.data),
    purchaseOrders: (id: number) =>
        api.get<RcvPurchaseOrderOption[]>(`${BASE}/${id}/purchase-orders/`).then(r => r.data),
    confirmDraft: (id: number, invoiceId: number, key: string) =>
        api.post<FiscalMatchDetail>(`${BASE}/${id}/confirm-draft/`, { invoice_id: invoiceId }, idem(key)).then(r => r.data),
    createDraft: (id: number, purchaseOrderId: number, key: string) =>
        api.post<FiscalMatchDetail>(`${BASE}/${id}/create-draft/`, { purchase_order_id: purchaseOrderId }, idem(key)).then(r => r.data),
}
