import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reconciliationApi } from '../api/reconciliationApi'
import { showApiError } from '@/lib/errors'
import { staleTime } from '@/lib/query-config'

/** Prefijo de las queries del cuadre fiscal (las pantallas de cuadre lo reutilizan). */
export const FISCAL_RECONCILIATION_KEY = ['fiscal-reconciliation'] as const
// Prefijo de las ventas TUU (treasury TERMINAL_SALES_KEYS.all); feature vecina, sin importar su interior.
const TERMINAL_SALES_KEY = ['terminal-sales'] as const

export function useTerminalSaleCandidates(saleId: number, enabled: boolean) {
    const { data, isLoading, isError } = useQuery({
        queryKey: [...FISCAL_RECONCILIATION_KEY, 'candidates', saleId],
        queryFn: () => reconciliationApi.getTerminalSaleCandidates(saleId),
        enabled: enabled && saleId > 0,
        staleTime: staleTime.standard,
    })
    return { candidates: data ?? [], isLoading, isError }
}

function useInvalidateMatch() {
    const qc = useQueryClient()
    return () =>
        Promise.all([
            qc.invalidateQueries({ queryKey: TERMINAL_SALES_KEY }),
            qc.invalidateQueries({ queryKey: FISCAL_RECONCILIATION_KEY }),
        ])
}

export function useMatchTerminalSale() {
    const invalidate = useInvalidateMatch()
    return useMutation({
        mutationFn: ({ saleId, invoiceId }: { saleId: number; invoiceId: number }) =>
            reconciliationApi.matchTerminalSale(saleId, invoiceId),
        onSuccess: invalidate,
        onError: (e) => showApiError(e, 'No se pudo vincular el documento'),
    })
}

export function useUnmatchTerminalSale() {
    const invalidate = useInvalidateMatch()
    return useMutation({
        mutationFn: (saleId: number) => reconciliationApi.unmatchTerminalSale(saleId),
        onSuccess: invalidate,
        onError: (e) => showApiError(e, 'No se pudo desvincular el documento'),
    })
}
