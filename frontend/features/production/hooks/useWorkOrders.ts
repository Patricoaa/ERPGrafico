import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { invalidateCrossFeature } from '@/lib/invalidation'
import type { WorkOrder } from '@/features/production/types'
import { toPage, type Page } from '@/lib/pagination'
import { WORK_ORDERS_LIST_KEY } from './useWorkOrderMutations'

export { WORK_ORDERS_LIST_KEY }

interface WorkOrderFilters {
    status?: string
    search?: string
    date_from?: string
    date_to?: string
    due_date_after?: string
    due_date_before?: string
    my_tasks?: boolean
    page?: number
    page_size?: number
    [key: string]: string | number | boolean | undefined
}

export function useWorkOrders(filters?: WorkOrderFilters, initialData?: Page<WorkOrder>) {
    const queryClient = useQueryClient()

    const { page = 1, page_size = 50, my_tasks, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, my_tasks, ...restFilters }

    const query = useQuery({
        queryKey: [WORK_ORDERS_LIST_KEY, activeFilters],
        queryFn: async (): Promise<Page<WorkOrder>> => {
            const params = new URLSearchParams()
            params.append('page', String(page))
            params.append('page_size', String(page_size))
            if (restFilters?.status) params.append('status', String(restFilters.status))
            if (restFilters?.search) params.append('search', String(restFilters.search))
            if (restFilters?.date_from) params.append('due_date_after', String(restFilters.date_from))
            if (restFilters?.date_to) params.append('due_date_before', String(restFilters.date_to))
            if (restFilters?.due_date_after) params.append('due_date_after', String(restFilters.due_date_after))
            if (restFilters?.due_date_before) params.append('due_date_before', String(restFilters.due_date_before))
            if (my_tasks) params.append('my_tasks', 'true')
            const res = await api.get('/production/orders/', { params })
            return toPage<WorkOrder>(res.data, page, page_size)
        },
        staleTime: 2 * 60 * 1000,
        initialData,
        placeholderData: (prev) => prev,
    })

    const orders = query.data?.results ?? []
    const showSkeleton = query.isLoading && !orders.length
    const isRefetching = query.isFetching && !showSkeleton
    const refetch = query.refetch

    const invalidateList = () =>
        invalidateCrossFeature(queryClient, [[WORK_ORDERS_LIST_KEY]])

    return { page: query.data, orders, isLoading: showSkeleton, isRefetching, refetch, invalidateList }
}

export function useWorkOrder(id: string | number) {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['workOrder', String(id)],
        queryFn: async (): Promise<WorkOrder> => {
            const res = await api.get(`/production/orders/${id}/`)
            return res.data
        },
        staleTime: 2 * 60 * 1000,
        enabled: !!id,
    })
    return { order: data, isLoading, isError, refetch }
}
