import api from '@/lib/api'
import { errorEnvelope } from '@/lib/errors'
import { toPage, type Page } from '@/lib/pagination'
import type {
    FiscalMatchCounts,
    FiscalMatchDetail,
    FiscalMatchFilters,
    FiscalMatchChange,
    FiscalMatchListItem,
    FiscalMatchPart,
    FiscalMatchSearchItem,
    FiscalMatchSearchParams,
    RcvDocumentCandidate,
    RcvPurchaseOrderOption,
} from '../types/fiscalMatch'

const BASE = '/tax/fiscal-matches'
export const FISCAL_MATCH_PAGE_SIZE = 50
/** Tamaño fijo de página del backend para `search`. */
export const FISCAL_MATCH_SEARCH_PAGE_SIZE = 20

const idem = (key: string) => ({ headers: { 'Idempotency-Key': key } })

/** Error 400 de `apply`: qué regla falló (`code`) y qué cambio la causó (`changeIndex`); `null` si no es de `apply`. */
export function applyErrorOf(error: unknown): { code: string; changeIndex: number; message: string } | null {
    const env = errorEnvelope(error)
    const index = env?.details.change_index
    return env && typeof index === 'number' ? { code: env.code, changeIndex: index, message: env.message } : null
}

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
    /** Una página (20 fijas) de tarjetas candidatas de una columna; `ordering` por defecto `score`. */
    search: async (id: number, part: FiscalMatchPart, { q, ordering }: FiscalMatchSearchParams, page = 1, signal?: AbortSignal): Promise<Page<FiscalMatchSearchItem>> => {
        const params = new URLSearchParams({ part, page: String(page) })
        if (q) params.set('q', q)
        if (ordering) params.set('ordering', ordering)
        const response = await api.get(`${BASE}/${id}/search/`, { params, signal })
        return toPage<FiscalMatchSearchItem>(response.data, page, FISCAL_MATCH_SEARCH_PAGE_SIZE)
    },
    apply: (id: number, changes: FiscalMatchChange[], key: string) =>
        api.post<FiscalMatchDetail>(`${BASE}/${id}/apply/`, { changes }, idem(key)).then(r => r.data),
    release: (id: number, key: string) =>
        api.post<FiscalMatchDetail>(`${BASE}/${id}/release/`, {}, idem(key)).then(r => r.data),
    retryIssue: (id: number, key: string) =>
        api.post<FiscalMatchDetail>(`${BASE}/${id}/retry-issue/`, {}, idem(key)).then(r => r.data),

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
