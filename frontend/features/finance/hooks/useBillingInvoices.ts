import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import { FINANCE_KEYS } from './queryKeys'

export function useBillingInvoices() {
    return useQuery({
        queryKey: [...FINANCE_KEYS.pendingInvoices.all(), 'all'],
        queryFn: () => financeApi.getBillingInvoices(),
        staleTime: 2 * 60 * 1000,
    })
}
