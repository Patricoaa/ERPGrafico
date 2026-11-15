import { FISCAL_RECONCILIATION_KEY } from '@/lib/fiscal-match'

// Prefijos de features vecinas, sin importar su interior (accounting y treasury importan tax).
/** accounting `RCV_KEYS.documents()` */
export const RCV_DOCUMENTS_KEY = ['accounting-rcv', 'documents'] as const
/** treasury `TERMINAL_SALES_KEYS.all` */
export const TERMINAL_SALES_KEY = ['terminal-sales'] as const

export const RECONCILIATION_KEYS = {
    all: FISCAL_RECONCILIATION_KEY,
    report: (year: number, month: number) => [...FISCAL_RECONCILIATION_KEY, 'report', year, month] as const,
    rcvCandidates: (docId: number) => [...FISCAL_RECONCILIATION_KEY, 'rcv-candidates', docId] as const,
}
