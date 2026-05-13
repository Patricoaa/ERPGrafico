import { useQuery } from '@tanstack/react-query'
import { getPayrolls } from '../api/hrApi'
import type { Payroll } from '@/types/hr'
import type { FilterState } from '@/components/shared'

export const PAYROLLS_QUERY_KEY = ['hr', 'payrolls'] as const

export function usePayrolls(filters?: FilterState) {
    const { data, isLoading, refetch } = useQuery({
        queryKey: [...PAYROLLS_QUERY_KEY, filters],
        queryFn: (): Promise<Payroll[]> => {
            const params: Record<string, string> = {}
            if (filters?.search) params.search = filters.search
            if (filters?.status) params.status = filters.status
            if (filters?.period_year) params.period_year = filters.period_year
            return getPayrolls(Object.keys(params).length ? params : undefined)
        },
        staleTime: 2 * 60 * 1000,
    })

    return {
        payrolls: data ?? [],
        isLoading,
        refetch,
    }
}
