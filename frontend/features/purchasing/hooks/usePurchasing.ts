import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FilterState } from '@/components/shared'
import type { Invoice } from '@/features/billing'
import { useRealtime } from '@/features/realtime'
import { useAuth } from '@/contexts/AuthContext'

import { purchasingApi } from '../api/purchasingApi'
import type { PurchaseOrderAPI } from '../types'
import { PURCHASING_KEYS } from './queryKeys'
import type { Page } from '@/lib/pagination'

export { PURCHASING_KEYS }

export function usePurchasingOrders(filters?: FilterState & { page?: number, page_size?: number }, initialData?: Page<PurchaseOrderAPI>) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const { isAuthenticated } = useAuth()

    const { page = 1, page_size = 50, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, ...restFilters }

    const query = useQuery({
        queryKey: [...PURCHASING_KEYS.orders(), activeFilters],
        queryFn: () => purchasingApi.getOrders(activeFilters),
        staleTime: 2 * 60 * 1000,
        enabled: isAuthenticated,
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
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.lists() })
            toast.success('Orden de Compra eliminada')
        },
    })

    const annulMutation = useMutation({
        mutationFn: ({ id, force, reason }: { id: number, force: boolean, reason?: string }) =>
            purchasingApi.annulOrder(id, { force, reason }),
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
            toast.success('Orden de Compra anulada correctamente.')
        },
        onError: (error: Error) => {
            console.error("Error annulling order", error)
        }
    })

    return {
        page: query.data,
        orders,
        isLoading: showSkeleton,
        isRefetching,
        refetch,
        deleteOrder: deleteMutation.mutateAsync,
        annulOrder: annulMutation.mutateAsync,
        isAnnulling: annulMutation.isPending,
    }
}

export function usePurchasingNotes(initialData?: Invoice[]) {
    const { isAuthenticated } = useAuth()

    const query = useQuery({
        queryKey: PURCHASING_KEYS.notes(),
        queryFn: () => purchasingApi.getNotes(),
        staleTime: 2 * 60 * 1000,
        enabled: isAuthenticated,
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
        staleTime: 2 * 60 * 1000,
    })

    return { order, isLoading }
}

export function usePurchaseReceipt(id: number | null, enabled = true) {
    const { data: receipt, isLoading } = useQuery({
        queryKey: [...PURCHASING_KEYS.all, 'receipt', id],
        queryFn: () => purchasingApi.getReceipt(id as number),
        staleTime: 2 * 60 * 1000,
        enabled: !!id && enabled,
    })

    return { receipt, isLoading }
}

export function usePurchaseReturn(id: number | null, enabled = true) {
    const { data: returnData, isLoading } = useQuery({
        queryKey: [...PURCHASING_KEYS.all, 'return', id],
        queryFn: () => purchasingApi.getReturn(id as number),
        staleTime: 2 * 60 * 1000,
        enabled: !!id && enabled,
    })

    return { returnData, isLoading }
}
