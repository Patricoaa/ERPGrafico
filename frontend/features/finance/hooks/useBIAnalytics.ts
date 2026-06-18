import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import { FINANCE_KEYS } from './queryKeys'

export function useBIAnalytics(params?: Record<string, unknown>) {
    return useQuery({
        queryKey: [...FINANCE_KEYS.all, 'bi-analytics', { params }] as const,
        queryFn: () => financeApi.getBIAnalytics(params),
        staleTime: 5 * 60 * 1000,
    })
}
