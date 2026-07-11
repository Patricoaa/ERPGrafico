import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../api/inventoryApi'
import type { InventoryDocumentFilters, InventoryDocument } from '../types'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'

export const INVENTORY_DOCUMENTS_QUERY_KEY = ['inventory', 'documents'] as const

export function useInventoryDocuments(filters: InventoryDocumentFilters = {}) {
    const { page = 1, page_size = 50, ...rest } = filters

    const { data: page_, isLoading, isFetching, refetch } = useQuery({
        queryKey: [...INVENTORY_DOCUMENTS_QUERY_KEY, { page, page_size, ...rest }],
        queryFn: () => inventoryApi.getInventoryDocuments({ page, page_size, ...rest }),
        staleTime: 2 * 60 * 1000, // 2 minutes (Transactional)
    })

    return {
        page: page_,
        documents: page_?.results ?? [],
        totalCount: page_?.count ?? 0,
        isLoading,
        isFetching,
        refetch,
    }
}

export function useInventoryDocument(id: number | string | null | undefined) {
    return useQuery<InventoryDocument>({
        queryKey: id ? [...INVENTORY_DOCUMENTS_QUERY_KEY, 'detail', id] : [...INVENTORY_DOCUMENTS_QUERY_KEY, 'detail', 'noop'],
        queryFn: () => inventoryApi.getInventoryDocument(id!),
        enabled: id !== null && id !== undefined && id !== '',
    })
}

export function useInventoryDocumentMutations(id?: number | string) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const confirmMutation = useMutation({
        mutationFn: (docId: number | string) => inventoryApi.confirmInventoryDocument(docId),
        onSuccess: (data) => {
            markLocalMutation()
            // Invalidate list and detail queries
            queryClient.invalidateQueries({ queryKey: INVENTORY_DOCUMENTS_QUERY_KEY })
            if (id) {
                queryClient.invalidateQueries({ queryKey: [...INVENTORY_DOCUMENTS_QUERY_KEY, 'detail', id] })
            }
            // Invalidate stock reports since stock levels changed
            invalidateCrossFeature(queryClient, [['inventory', 'stockReport'], ['inventory', 'stockMoves']])
        }
    })

    const annulMutation = useMutation({
        mutationFn: (docId: number | string) => inventoryApi.annulInventoryDocument(docId),
        onSuccess: (data) => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: INVENTORY_DOCUMENTS_QUERY_KEY })
            if (id) {
                queryClient.invalidateQueries({ queryKey: [...INVENTORY_DOCUMENTS_QUERY_KEY, 'detail', id] })
            }
            invalidateCrossFeature(queryClient, [['inventory', 'stockReport'], ['inventory', 'stockMoves']])
        }
    })

    return {
        confirmDocument: confirmMutation.mutateAsync,
        isConfirming: confirmMutation.isPending,
        annulDocument: annulMutation.mutateAsync,
        isAnnulling: annulMutation.isPending,
    }
}

export function useAdjustmentMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const createMutation = useMutation({
        mutationFn: (payload: { adjustment_type: string, warehouse: number, notes?: string }) => inventoryApi.createAdjustment(payload),
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: INVENTORY_DOCUMENTS_QUERY_KEY })
        }
    })

    const startCountMutation = useMutation({
        mutationFn: (docId: number | string) => inventoryApi.startCount(docId),
        onSuccess: (data, docId) => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: INVENTORY_DOCUMENTS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: [...INVENTORY_DOCUMENTS_QUERY_KEY, 'detail', docId] })
        }
    })

    const applyMutation = useMutation({
        mutationFn: (docId: number | string) => inventoryApi.applyAdjustment(docId),
        onSuccess: (data, docId) => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: INVENTORY_DOCUMENTS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: [...INVENTORY_DOCUMENTS_QUERY_KEY, 'detail', docId] })
            invalidateCrossFeature(queryClient, [['inventory', 'stockReport'], ['inventory', 'stockMoves']])
        }
    })

    return {
        createAdjustment: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        startCount: startCountMutation.mutateAsync,
        isStarting: startCountMutation.isPending,
        applyAdjustment: applyMutation.mutateAsync,
        isApplying: applyMutation.isPending,
    }
}

export function usePickingTypes() {
    return useQuery({
        queryKey: ['inventory', 'pickingTypes'],
        queryFn: () => inventoryApi.getPickingTypes(),
        staleTime: 5 * 60 * 1000,
    })
}

export function usePickingMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const createMutation = useMutation({
        mutationFn: (payload: { picking_type: number, warehouse: number, partner?: number, origin?: string }) => inventoryApi.createPicking(payload),
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: INVENTORY_DOCUMENTS_QUERY_KEY })
        }
    })

    return {
        createPicking: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
    }
}
