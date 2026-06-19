import { useQuery } from '@tanstack/react-query'
import { getAbsences } from '../api/hrApi'
import type { Absence } from '@/types/hr'
import type { FilterState } from '@/components/shared'

export const ABSENCES_QUERY_KEY = ['hr', 'absences'] as const

export function useAbsences(filters?: FilterState, initialData?: Absence[]) {
    const query = useQuery({
        queryKey: [...ABSENCES_QUERY_KEY, filters],
        queryFn: (): Promise<Absence[]> => {
            const params: Record<string, string> = {}
            if (filters?.absence_type) params.absence_type = filters.absence_type
            if (filters?.start_date_after) params.start_date_after = filters.start_date_after
            if (filters?.start_date_before) params.start_date_before = filters.start_date_before
            return getAbsences(Object.keys(params).length ? params : undefined)
        },
        staleTime: 2 * 60 * 1000,
        initialData,
        placeholderData: (prev) => prev,
    })

    const absences = query.data ?? []
    const showSkeleton = query.isLoading && !absences.length
    const refetch = query.refetch
    const isRefetching = query.isFetching && !showSkeleton

    return {
        absences,
        isLoading: showSkeleton,
        refetch,
        isRefetching,
    }
}
