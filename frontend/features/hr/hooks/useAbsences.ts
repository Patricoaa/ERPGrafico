import { useQuery } from '@tanstack/react-query'
import { getAbsences } from '../api/hrApi'
import type { Absence } from '@/types/hr'
import type { FilterState } from '@/components/shared'

export const ABSENCES_QUERY_KEY = ['hr', 'absences'] as const

export function useAbsences(filters?: FilterState) {
    const { data, isLoading, refetch } = useQuery({
        queryKey: [...ABSENCES_QUERY_KEY, filters],
        queryFn: (): Promise<Absence[]> => {
            const params: Record<string, string> = {}
            if (filters?.absence_type) params.absence_type = filters.absence_type
            if (filters?.date_from) params.start_date_after = filters.date_from
            if (filters?.date_to) params.start_date_before = filters.date_to
            return getAbsences(Object.keys(params).length ? params : undefined)
        },
        staleTime: 2 * 60 * 1000,
    })

    return {
        absences: data ?? [],
        isLoading,
        refetch,
    }
}
