import { FISCAL_MATCH_KEY } from '@/lib/fiscal-match'
import type { FiscalMatchFilters, FiscalMatchPart } from '../types/fiscalMatch'

export { FISCAL_MATCH_KEY }

export const FISCAL_MATCH_KEYS = {
    all: FISCAL_MATCH_KEY,
    list: (filters: FiscalMatchFilters, page: number) => [...FISCAL_MATCH_KEY, 'list', filters, page] as const,
    counts: (filters: FiscalMatchFilters) => [...FISCAL_MATCH_KEY, 'counts', filters] as const,
    detail: (id: number) => [...FISCAL_MATCH_KEY, 'detail', id] as const,
    candidates: (id: number, part: FiscalMatchPart) => [...FISCAL_MATCH_KEY, 'candidates', id, part] as const,
    summary: (year: number, month: number) => [...FISCAL_MATCH_KEY, 'summary', year, month] as const,
    pendingIssue: () => [...FISCAL_MATCH_KEY, 'pending-issue'] as const,
    draftSuggestions: (id: number) => [...FISCAL_MATCH_KEY, 'draft-suggestions', id] as const,
    purchaseOrders: (id: number) => [...FISCAL_MATCH_KEY, 'purchase-orders', id] as const,
}
