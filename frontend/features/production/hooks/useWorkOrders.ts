import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { invalidateCrossFeature } from '@/lib/invalidation'
import type { WorkOrder } from '@/features/production/types'
import { toPage, type Page } from '@/lib/pagination'
import { WORK_ORDERS_LIST_KEY } from './useWorkOrderMutations'
import { staleTime } from '@/lib/query-config'

export { WORK_ORDERS_LIST_KEY }

interface WorkOrderFilters {
    status?: string
    search?: string
    date_from?: string
    date_to?: string
    due_date_after?: string
    due_date_before?: string
    my_tasks?: boolean
    current_stage?: string
    page?: number
    page_size?: number
    [key: string]: string | number | boolean | undefined
}

/** List params of `/production/orders/` (no paging): shared by the rows and their groups (ADR-0158 §7). */
export function workOrderListParams(filters: Omit<WorkOrderFilters, 'page' | 'page_size'>): URLSearchParams {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', String(filters.status))
    if (filters.current_stage) params.append('current_stage', String(filters.current_stage))
    if (filters.search) params.append('search', String(filters.search))
    if (filters.date_from) params.append('due_date_after', String(filters.date_from))
    if (filters.date_to) params.append('due_date_before', String(filters.date_to))
    if (filters.due_date_after) params.append('due_date_after', String(filters.due_date_after))
    if (filters.due_date_before) params.append('due_date_before', String(filters.due_date_before))
    if (filters.my_tasks) params.append('my_tasks', 'true')
    return params
}

export async function fetchWorkOrders(filters: WorkOrderFilters, page: number, pageSize: number): Promise<Page<WorkOrder>> {
    const params = workOrderListParams(filters)
    params.append('page', String(page))
    params.append('page_size', String(pageSize))
    const res = await api.get('/production/orders/', { params })
    return toPage<WorkOrder>(res.data, page, pageSize)
}

export function useWorkOrders(filters?: WorkOrderFilters, initialData?: Page<WorkOrder>, enabled = true) {
    const queryClient = useQueryClient()

    const { page = 1, page_size = 50, my_tasks, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, my_tasks, ...restFilters }

    const query = useQuery({
        queryKey: [WORK_ORDERS_LIST_KEY, activeFilters],
        queryFn: () => fetchWorkOrders({ ...restFilters, my_tasks }, page, page_size),
        staleTime: staleTime.standard,
        enabled,
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
        staleTime: staleTime.standard,
        enabled: !!id,
    })
    return { order: data, isLoading, isError, refetch }
}
