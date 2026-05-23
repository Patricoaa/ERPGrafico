import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'

export function usePendingInvoices(enabled: boolean = true) {
    return useQuery({
        queryKey: ['billing', 'pending-invoices'],
        queryFn: () => financeApi.getPendingInvoices({ status: 'DRAFT,ISSUED,AUTHORIZED' }),
        enabled,
    })
}
