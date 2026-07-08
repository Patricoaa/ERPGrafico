import { useQuery } from '@tanstack/react-query'
import { getAdvances } from '../api/hrApi'
import type { SalaryAdvance } from '@/types/hr'
import type { FilterState } from '@/components/shared'

export const SALARY_ADVANCES_QUERY_KEY = ['hr', 'advances'] as const

export function useSalaryAdvances(filters?: FilterState, initialData?: SalaryAdvance[]) {
    const query = useQuery({
        queryKey: [...SALARY_ADVANCES_QUERY_KEY, filters],
        queryFn: (): Promise<SalaryAdvance[]> => {
            const params: Record<string, string> = {}
            if (filters?.is_discounted !== undefined) params.is_discounted = filters.is_discounted
            return getAdvances(Object.keys(params).length ? params : undefined)
        },
        staleTime: 2 * 60 * 1000,
        initialData,
        placeholderData: (prev) => prev,
    })

    const advances = query.data ?? []
    const showSkeleton = query.isLoading && !advances.length
    const refetch = query.refetch
    const isRefetching = query.isFetching && !showSkeleton

    return {
        advances,
        isLoading: showSkeleton,
        refetch,
        isRefetching,
    }
}
