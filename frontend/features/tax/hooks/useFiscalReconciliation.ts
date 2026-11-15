import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import { showApiError } from '@/lib/errors'
import { staleTime } from '@/lib/query-config'
import { reconciliationApi } from '../api/reconciliationApi'
import type { ReconciliationRunParams } from '../types/reconciliation'
import { RCV_DOCUMENTS_KEY, RECONCILIATION_KEYS, TERMINAL_SALES_KEY } from './reconciliationKeys'

/** Reporte de cuadre fiscal del período (ERP frente a TUU y el RCV del SII). */
export function useFiscalReconciliation(year: number, month: number) {
    const { data, isLoading, isError, isRefetching, refetch } = useQuery({
        queryKey: RECONCILIATION_KEYS.report(year, month),
        queryFn: () => reconciliationApi.getReport(year, month),
        staleTime: staleTime.standard,
    })
    return { report: data, isLoading, isError, isRefetching, refetch }
}

const RUN_LABELS: Record<ReconciliationRunParams['source'], string> = { rcv: 'RCV', terminal: 'TUU' }

/** Recalcula el cuadre del RCV o de TUU para un período; los vínculos manuales no cambian. */
export function useRunReconciliation() {
    const qc = useQueryClient()
    const { markLocalMutation } = useRealtime()
    return useMutation({
        mutationFn: (params: ReconciliationRunParams) => reconciliationApi.run(params),
        onSuccess: (_data, { source }) => {
            markLocalMutation()
            toast.success(`Cuadre ${RUN_LABELS[source]} recalculado`)
            return Promise.all([
                qc.invalidateQueries({ queryKey: RECONCILIATION_KEYS.all }),
                qc.invalidateQueries({ queryKey: source === 'rcv' ? RCV_DOCUMENTS_KEY : TERMINAL_SALES_KEY }),
            ])
        },
        onError: (e, { source }) => showApiError(e, `No se pudo recalcular el cuadre ${RUN_LABELS[source]}`),
    })
}
