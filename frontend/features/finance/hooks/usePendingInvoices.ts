import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import { FINANCE_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

export function usePendingInvoices(enabled: boolean = true) {
    return useQuery({
        queryKey: FINANCE_KEYS.pendingInvoices.all(),
        queryFn: () => financeApi.getPendingInvoices({ status: 'DRAFT,ISSUED,AUTHORIZED' }),
        staleTime: staleTime.standard,
        enabled,
    })
}
