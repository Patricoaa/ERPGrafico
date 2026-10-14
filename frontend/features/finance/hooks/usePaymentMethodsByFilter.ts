import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import { FINANCE_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

export function usePaymentMethodsByFilter(filter: Record<string, string | boolean> | null) {
    return useQuery({
        queryKey: [...FINANCE_KEYS.all, 'payment-methods', filter],
        queryFn: () => financeApi.getPaymentMethods(filter ?? undefined),
        enabled: !!filter,
        staleTime: staleTime.standard,
    })
}
