import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../api/inventoryApi'
import type { InventoryCountFilters } from '../types'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'

export const INVENTORY_COUNTS_QUERY_KEY = ['inventory', 'counts'] as const

export function useInventoryCounts(filters: InventoryCountFilters = {}) {
    const { page = 1, page_size = 50, ...rest } = filters
    const { data: page_, isLoading, isFetching, refetch } = useQuery({
        queryKey: [...INVENTORY_COUNTS_QUERY_KEY, { page, page_size, ...rest }],
        queryFn: () => inventoryApi.getInventoryCounts({ page, page_size, ...rest }),
        staleTime: 2 * 60 * 1000,
    })
    return {
        page: page_,
        counts: page_?.results ?? [],
        totalCount: page_?.count ?? 0,
        isLoading, isFetching, refetch,
    }
}

export function useInventoryCount(id: number | string | null | undefined) {
    return useQuery({
        queryKey: id ? [...INVENTORY_COUNTS_QUERY_KEY, 'detail', id] : ['noop'],
        queryFn: () => inventoryApi.getInventoryCount(Number(id)),
        enabled: id !== null && id !== undefined,
    })
}

export function useInventoryCountMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const createMutation = useMutation({
        mutationFn: (payload: { warehouse: number, notes?: string }) =>
            inventoryApi.createInventoryCount(payload),
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: INVENTORY_COUNTS_QUERY_KEY })
        },
    })

    const saveLinesMutation = useMutation({
        mutationFn: ({ id, lines }: { id: number, lines: Array<{ line_id: number, counted_qty: number }> }) =>
            inventoryApi.saveInventoryCountLines(id, lines),
        onSuccess: (data) => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: INVENTORY_COUNTS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: [...INVENTORY_COUNTS_QUERY_KEY, 'detail', data.id] })
        },
    })

    const applyMutation = useMutation({
        mutationFn: (id: number) => inventoryApi.applyInventoryCount(id),
        onSuccess: (data) => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: INVENTORY_COUNTS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: [...INVENTORY_COUNTS_QUERY_KEY, 'detail', data.id] })
            invalidateCrossFeature(queryClient, [['inventory', 'stockReport'], ['inventory', 'stockMoves'], ['inventory', 'documents']])
        },
    })

    return {
        createCount: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        saveLines: saveLinesMutation.mutateAsync,
        isSaving: saveLinesMutation.isPending,
        applyCount: applyMutation.mutateAsync,
        isApplying: applyMutation.isPending,
    }
}
