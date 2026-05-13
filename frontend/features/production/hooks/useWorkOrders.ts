import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { FilterState } from '@/components/shared'
import type { WorkOrder } from '@/features/production/types'
import { WORK_ORDERS_LIST_KEY } from './useWorkOrderMutations'

export { WORK_ORDERS_LIST_KEY }

export function useWorkOrders(filters?: FilterState) {
    const queryClient = useQueryClient()

    const { data, isLoading, refetch } = useQuery({
        queryKey: [WORK_ORDERS_LIST_KEY, filters],
        queryFn: async (): Promise<WorkOrder[]> => {
            const params = new URLSearchParams()
            if (filters?.status) params.append('status', filters.status)
            if (filters?.search) params.append('search', filters.search)
            if (filters?.date_from) params.append('due_date_after', filters.date_from)
            if (filters?.date_to) params.append('due_date_before', filters.date_to)
            const res = await api.get('/production/orders/', { params })
            return res.data.results || res.data
        },
        staleTime: 2 * 60 * 1000,
    })

    const invalidateList = () =>
        queryClient.invalidateQueries({ queryKey: [WORK_ORDERS_LIST_KEY] })

    return { orders: data ?? [], isLoading, refetch, invalidateList }
}
