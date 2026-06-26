import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import { FINANCE_KEYS } from './queryKeys'

export function usePendingInvoices(enabled: boolean = true) {
    return useQuery({
        queryKey: FINANCE_KEYS.pendingInvoices.all(),
        queryFn: () => financeApi.getPendingInvoices({ status: 'DRAFT,ISSUED,AUTHORIZED' }),
        staleTime: 2 * 60 * 1000,
        enabled,
    })
}
