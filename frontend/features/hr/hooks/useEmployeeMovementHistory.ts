import { useQuery } from '@tanstack/react-query'
import { getEmployeeMovementHistory } from '../api/hrApi'
import { staleTime } from '@/lib/query-config'
import { EMPLOYEE_MOVEMENTS_QUERY_KEY } from './useEmployeeMovements'

/** Historial unificado (pagos, anticipos y préstamos) de un empleado; inactivo si `employeeId` es null. */
export function useEmployeeMovementHistory(employeeId: number | null) {
    const query = useQuery({
        queryKey: [...EMPLOYEE_MOVEMENTS_QUERY_KEY, 'history', employeeId],
        queryFn: () => getEmployeeMovementHistory(employeeId as number),
        enabled: employeeId !== null,
        staleTime: staleTime.standard,
    })
    return {
        movements: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
    }
}
