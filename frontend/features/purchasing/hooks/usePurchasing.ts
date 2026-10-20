import { useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { useAuth } from '@/contexts/AuthContext'

import { purchasingApi, type OrderFilters } from '../api/purchasingApi'
import type { PurchaseReceipt } from '../entity-view/purchaseReceipt.entity'
import type { PurchaseReturn } from '../entity-view/purchaseReturn.entity'
import { PURCHASING_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

export { PURCHASING_KEYS }

export function usePurchasingOrders({ filters }: { filters?: OrderFilters } = {}) {
    const { isAuthenticated } = useAuth()

    const { page = 1, page_size = 50, ...restFilters } = filters || {}
    const activeFilters = { page, page_size, ...restFilters }

    const query = useQuery({
        queryKey: [...PURCHASING_KEYS.orders(), activeFilters],
        queryFn: () => purchasingApi.getOrders(activeFilters),
        staleTime: staleTime.standard,
        enabled: isAuthenticated,
        placeholderData: (prev) => prev,
    })

    const orders = query.data?.results ?? []
    const showSkeleton = query.isLoading && !orders.length

    return {
        page: query.data,
        orders,
        isLoading: showSkeleton,
        isRefetching: query.isFetching && !showSkeleton,
        isError: query.isError,
        refetch: query.refetch,
    }
}

/** Refreshes the order lists and their analytics (both live under `PURCHASING_KEYS.orders()`). */
export function useRefreshPurchaseOrders() {
    const queryClient = useQueryClient()
    return () => invalidateCrossFeature(queryClient, [PURCHASING_KEYS.orders()])
}

export function usePurchasingNotes({ filters, page = 1, page_size = 50 }: { filters?: Record<string, string>; page?: number; page_size?: number } = {}) {
    const { isAuthenticated } = useAuth()
    const activeFilters = { filters, page, page_size }

    const query = useQuery({
        queryKey: PURCHASING_KEYS.notes(activeFilters),
        queryFn: () => purchasingApi.getNotes(activeFilters),
        staleTime: staleTime.standard,
        enabled: isAuthenticated,
        placeholderData: (prev) => prev,
    })

    const notes = query.data?.results ?? []
    const showSkeleton = query.isLoading && !notes.length

    return {
        page: query.data,
        notes,
        isLoading: showSkeleton,
        isRefetching: query.isFetching && !showSkeleton,
        isError: query.isError,
        refetch: query.refetch,
    }
}

export function usePurchasingOrder(id: number) {
    const { data: order, isLoading } = useQuery({
        queryKey: PURCHASING_KEYS.detail(id),
        queryFn: () => purchasingApi.getOrder(id),
        staleTime: staleTime.standard,
    })

    return { order, isLoading }
}

export function usePurchaseReceipts(filters?: Record<string, unknown>) {
    const page = Number(filters?.page ?? 1)
    const pageSize = Number(filters?.page_size ?? 50)
    const query = useQuery({
        queryKey: PURCHASING_KEYS.receipts({ page, page_size: pageSize, ...filters }),
        queryFn: () => purchasingApi.getReceiptsPaginated({ page, page_size: pageSize, ...filters }),
        staleTime: staleTime.standard,
    })

    return {
        page: query.data,
        receipts: (query.data?.results ?? []) as unknown as PurchaseReceipt[],
        totalCount: query.data?.count ?? 0,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isError: query.isError,
        refetch: query.refetch,
    }
}

export function usePurchaseReceipt(id: number | null, enabled = true) {
    const { data: receipt, isLoading } = useQuery({
        queryKey: PURCHASING_KEYS.receipt(id as number),
        queryFn: () => purchasingApi.getReceipt(id as number),
        staleTime: staleTime.standard,
        enabled: !!id && enabled,
    })

    return { receipt, isLoading }
}

export function usePurchaseReturn(id: number | null, enabled = true) {
    const { data: returnData, isLoading } = useQuery({
        queryKey: [...PURCHASING_KEYS.all, 'return', id],
        queryFn: () => purchasingApi.getReturn(id as number),
        staleTime: staleTime.standard,
        enabled: !!id && enabled,
    })

    return { returnData, isLoading }
}

/** Paginated list of purchase returns (ADR-0090: "Devoluciones" is its own document list). */
export function usePurchaseReturns(filters?: Record<string, unknown>) {
    const page = Number(filters?.page ?? 1)
    const pageSize = Number(filters?.page_size ?? 50)
    const query = useQuery({
        queryKey: [...PURCHASING_KEYS.all, 'returns', { page, page_size: pageSize, ...filters }],
        queryFn: () => purchasingApi.getReturnsPaginated({ page, page_size: pageSize, ...filters }),
        staleTime: staleTime.standard,
    })

    return {
        page: query.data,
        returns: (query.data?.results ?? []) as unknown as PurchaseReturn[],
        totalCount: query.data?.count ?? 0,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isError: query.isError,
        refetch: query.refetch,
    }
}
