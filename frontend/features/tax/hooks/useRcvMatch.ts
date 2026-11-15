import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { showApiError } from '@/lib/errors'
import { staleTime } from '@/lib/query-config'
import { reconciliationApi } from '../api/reconciliationApi'
import { RCV_DOCUMENTS_KEY, RECONCILIATION_KEYS } from './reconciliationKeys'

/** Facturas del ERP que podrían corresponder al documento RCV (solo si aún no está vinculado). */
export function useRcvDocumentCandidates(docId: number, enabled: boolean) {
    const { data, isLoading, isError } = useQuery({
        queryKey: RECONCILIATION_KEYS.rcvCandidates(docId),
        queryFn: () => reconciliationApi.getRcvDocumentCandidates(docId),
        enabled: enabled && docId > 0,
        staleTime: staleTime.standard,
    })
    return { candidates: data ?? [], isLoading, isError }
}

function useInvalidateRcvMatch() {
    const qc = useQueryClient()
    return () =>
        Promise.all([
            qc.invalidateQueries({ queryKey: RCV_DOCUMENTS_KEY }),
            qc.invalidateQueries({ queryKey: RECONCILIATION_KEYS.all }),
        ])
}

export function useMatchRcvDocument() {
    const invalidate = useInvalidateRcvMatch()
    return useMutation({
        mutationFn: ({ docId, invoiceId }: { docId: number; invoiceId: number }) =>
            reconciliationApi.matchRcvDocument(docId, invoiceId),
        onSuccess: invalidate,
        onError: (e) => showApiError(e, 'No se pudo vincular el documento'),
    })
}

export function useUnmatchRcvDocument() {
    const invalidate = useInvalidateRcvMatch()
    return useMutation({
        mutationFn: (docId: number) => reconciliationApi.unmatchRcvDocument(docId),
        onSuccess: invalidate,
        onError: (e) => showApiError(e, 'No se pudo desvincular el documento'),
    })
}
