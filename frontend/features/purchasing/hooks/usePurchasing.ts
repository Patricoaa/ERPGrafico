import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FilterState } from '@/components/shared'
import type { Invoice } from '@/features/billing/types'

import { purchasingApi } from '../api/purchasingApi'
import type { PurchaseOrderAPI } from '../types'
import { PURCHASING_KEYS } from './queryKeys'

export { PURCHASING_KEYS }

export function usePurchasingOrders(filters?: FilterState & { page?: number, page_size?: number }, initialData?: any) {
    const queryClient = useQueryClient()

    const { page = 1, page_size = 50, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, ...restFilters }

    const query = useQuery({
        queryKey: [...PURCHASING_KEYS.orders(), activeFilters],
        queryFn: () => purchasingApi.getOrders(activeFilters),
        staleTime: 2 * 60 * 1000,
        initialData,
        placeholderData: (prev) => prev,
    })

    const orders = query.data?.results ?? []
    const showSkeleton = query.isLoading && !orders.length
    const isRefetching = query.isFetching && !showSkeleton
    const refetch = query.refetch

    const deleteMutation = useMutation({
        mutationFn: (id: number) => purchasingApi.deleteOrder(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.lists() })
            toast.success('Orden de Compra eliminada')
        },
    })

    return {
        page: query.data,
        orders,
        isLoading: showSkeleton,
        isRefetching,
        refetch,
        deleteOrder: deleteMutation.mutateAsync,
    }
}

export function usePurchasingNotes(initialData?: Invoice[]) {
    const query = useQuery({
        queryKey: PURCHASING_KEYS.notes(),
        queryFn: () => purchasingApi.getNotes(),
        initialData,
        placeholderData: (prev) => prev,
    })

    const notes = query.data ?? []
    const showSkeleton = query.isLoading && !notes.length
    const isRefetching = query.isFetching && !showSkeleton
    const refetch = query.refetch

    return { notes, isLoading: showSkeleton, isRefetching, refetch }
}

export function usePurchasingOrder(id: number) {
    const { data: order, isLoading } = useQuery({
        queryKey: PURCHASING_KEYS.detail(id),
        queryFn: () => purchasingApi.getOrder(id),
    })

    return { order, isLoading }
}

export function usePurchaseReceipt(id: number | null, enabled = true) {
    const { data: receipt, isLoading } = useQuery({
        queryKey: [...PURCHASING_KEYS.all, 'receipt', id],
        queryFn: () => purchasingApi.getReceipt(id as number),
        enabled: !!id && enabled,
    })

    return { receipt, isLoading }
}

export function usePurchaseReturn(id: number | null, enabled = true) {
    const { data: returnData, isLoading } = useQuery({
        queryKey: [...PURCHASING_KEYS.all, 'return', id],
        queryFn: () => purchasingApi.getReturn(id as number),
        enabled: !!id && enabled,
    })

    return { returnData, isLoading }
}
