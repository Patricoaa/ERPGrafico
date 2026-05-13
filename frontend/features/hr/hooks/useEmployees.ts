import { useQuery } from '@tanstack/react-query'
import { getEmployees } from '../api/hrApi'
import type { Employee } from '@/types/hr'
import type { FilterState } from '@/components/shared'

export const EMPLOYEES_QUERY_KEY = ['hr', 'employees'] as const

export function useEmployees(filters?: FilterState) {
    const { data, isLoading, refetch } = useQuery({
        queryKey: [...EMPLOYEES_QUERY_KEY, filters],
        queryFn: (): Promise<Employee[]> => {
            const params: Record<string, string> = {}
            if (filters?.search) params.search = filters.search
            if (filters?.status) params.status = filters.status
            return getEmployees(Object.keys(params).length ? params : undefined)
        },
        staleTime: 2 * 60 * 1000,
    })

    return {
        employees: data ?? [],
        isLoading,
        refetch,
    }
}
