import { useQuery } from '@tanstack/react-query'
import { accountingApi, type AccountingPeriodStatus } from '../api/accountingApi'
import { accountingPeriodStatusQueryKey } from './queryKeys'

/**
 * Estado del checklist de cierre de un período contable (`status_check`): requisitos, conteos y
 * documentos pendientes por categoría. Siempre fresco: el checklist decide si se puede cerrar.
 */
export function useAccountingPeriodStatus(periodId: number, enabled: boolean) {
    const query = useQuery({
        queryKey: accountingPeriodStatusQueryKey(periodId),
        queryFn: () => accountingApi.getAccountingPeriodStatus(periodId),
        enabled: enabled && periodId > 0,
        staleTime: 0,
    })

    const status: AccountingPeriodStatus | null = query.data ?? null

    return {
        status,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error,
        refetch: query.refetch,
    }
}
