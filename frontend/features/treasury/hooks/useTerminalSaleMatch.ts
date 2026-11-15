import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { TERMINAL_SALES_KEYS } from './queryKeys'
import { showApiError } from '@/lib/errors'
import { staleTime } from '@/lib/query-config'

/** Prefijo de las queries del cuadre fiscal (las pantallas de cuadre lo reutilizan). */
const FISCAL_RECONCILIATION_KEY = ['fiscal-reconciliation'] as const

export function useTerminalSaleCandidates(saleId: number, enabled: boolean) {
    const { data, isLoading, isError } = useQuery({
        queryKey: [...FISCAL_RECONCILIATION_KEY, 'candidates', saleId],
        queryFn: () => treasuryApi.getTerminalSaleCandidates(saleId),
        enabled: enabled && saleId > 0,
        staleTime: staleTime.standard,
    })
    return { candidates: data ?? [], isLoading, isError }
}

function useInvalidateMatch() {
    const qc = useQueryClient()
    return () =>
        Promise.all([
            qc.invalidateQueries({ queryKey: TERMINAL_SALES_KEYS.all }),
            qc.invalidateQueries({ queryKey: FISCAL_RECONCILIATION_KEY }),
        ])
}

export function useMatchTerminalSale() {
    const invalidate = useInvalidateMatch()
    return useMutation({
        mutationFn: ({ saleId, invoiceId }: { saleId: number; invoiceId: number }) =>
            treasuryApi.matchTerminalSale(saleId, invoiceId),
        onSuccess: invalidate,
        onError: (e) => showApiError(e, 'No se pudo vincular el documento'),
    })
}

export function useUnmatchTerminalSale() {
    const invalidate = useInvalidateMatch()
    return useMutation({
        mutationFn: (saleId: number) => treasuryApi.unmatchTerminalSale(saleId),
        onSuccess: invalidate,
        onError: (e) => showApiError(e, 'No se pudo desvincular el documento'),
    })
}
