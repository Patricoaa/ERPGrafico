import { useQuery } from '@tanstack/react-query'
import { getEmployees, getEmployee, getAFPs, getPayrollConcepts } from '../api/hrApi'
import type {Employee, PayrollConcept} from '@/types/hr'
import type { FilterState } from '@/components/shared'

export const EMPLOYEES_QUERY_KEY = ['hr', 'employees'] as const

export function useEmployees(filters?: FilterState, initialData?: Employee[]) {
    const query = useQuery({
        queryKey: [...EMPLOYEES_QUERY_KEY, filters],
        queryFn: (): Promise<Employee[]> => {
            const params: Record<string, string> = {}
            if (filters?.search) params.search = filters.search
            if (filters?.status) params.status = filters.status
            return getEmployees(Object.keys(params).length ? params : undefined)
        },
        staleTime: 2 * 60 * 1000,
        initialData,
        placeholderData: (prev) => prev,
    })

    const employees = query.data ?? []
    const showSkeleton = query.isLoading && !employees.length
    const refetch = query.refetch
    const isRefetching = query.isFetching && !showSkeleton

    return {
        employees,
        isLoading: showSkeleton,
        refetch,
        isRefetching,
    }
}

export function useEmployee(id: number | string | undefined) {
    return useQuery({
        queryKey: [...EMPLOYEES_QUERY_KEY, 'detail', id],
        queryFn: () => getEmployee(Number(id)),
        enabled: !!id,
    })
}

export function useEmployeeFormDeps(enabled: boolean) {
    return useQuery({
        queryKey: ['hr', 'employee-form-deps'],
        queryFn: async () => {
            const [afpsData, conceptsData] = await Promise.all([
                getAFPs(),
                getPayrollConcepts({ formula_type: 'EMPLOYEE_SPECIFIC' })
            ])
            return {
                afps: afpsData,
                concepts: conceptsData.filter((c: PayrollConcept) => c.formula_type === 'EMPLOYEE_SPECIFIC')
            }
        },
        enabled
    })
}
