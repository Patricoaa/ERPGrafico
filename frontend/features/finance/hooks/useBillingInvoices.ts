import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import { FINANCE_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

export function useBillingInvoices() {
    return useQuery({
        queryKey: [...FINANCE_KEYS.pendingInvoices.all(), 'all'],
        queryFn: () => financeApi.getBillingInvoices(),
        staleTime: staleTime.standard,
    })
}
