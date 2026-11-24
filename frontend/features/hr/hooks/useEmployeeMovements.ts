import { useQuery } from '@tanstack/react-query'
import { getEmployeeMovements } from '../api/hrApi'
import type { EmployeeMovement } from '@/types/hr'
import type { FilterState } from '@/components/shared'
import { staleTime } from '@/lib/query-config'

export const EMPLOYEE_MOVEMENTS_QUERY_KEY = ['hr', 'employee-movements'] as const

export function useEmployeeMovements(filters?: FilterState, initialData?: EmployeeMovement[]) {
    const query = useQuery({
        queryKey: [...EMPLOYEE_MOVEMENTS_QUERY_KEY, filters],
        queryFn: (): Promise<EmployeeMovement[]> => {
            const params: Record<string, string> = {}
            for (const key of ['kind', 'status', 'employee', 'payroll', 'date_from', 'date_to'] as const) {
                const value = filters?.[key]
                if (value) params[key] = String(value)
            }
            return getEmployeeMovements(Object.keys(params).length ? params : undefined)
        },
        staleTime: staleTime.standard,
        initialData,
        placeholderData: (prev) => prev,
    })

    const movements = query.data ?? []
    const showSkeleton = query.isLoading && !movements.length
    return {
        movements,
        isLoading: showSkeleton,
        isError: query.isError,
        refetch: query.refetch,
        isRefetching: query.isFetching && !showSkeleton,
    }
}
