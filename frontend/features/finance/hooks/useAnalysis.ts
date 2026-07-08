import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import { FINANCE_KEYS } from './queryKeys'

export function useAnalysis(params?: Record<string, unknown>) {
    const enabled = params != null
    return useQuery({
        queryKey: [...FINANCE_KEYS.all, 'analysis', { params }] as const,
        queryFn: () => financeApi.getAnalysis(params),
        enabled,
        staleTime: 5 * 60 * 1000,
    })
}
