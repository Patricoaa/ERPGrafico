import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { type BOM, type ProductMinimal } from '../types'
import { productionApi } from '../api/productionApi'
import { BOMS_QUERY_KEY, PRODUCTS_QUERY_KEY } from '@/features/inventory'
import { useRealtime } from '@/features/realtime'
import type { FilterState } from '@/components/shared'

export const ALL_BOMS_QUERY_KEY = ['all-boms']

// Re-export for backward compat
export { BOMS_QUERY_KEY }
export const VARIANTS_QUERY_KEY = ['product-variants']

export function useBOM(id: number | undefined) {
    return useQuery({
        queryKey: [...ALL_BOMS_QUERY_KEY, 'detail', id],
        queryFn: () => productionApi.getBOM(id as number),
        enabled: !!id,
        staleTime: 2 * 60 * 1000,
    })
}

export function useDeleteBomMutation() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    return useMutation({
        mutationFn: (id: number) => productionApi.deleteBom(id),
        onSuccess: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [BOMS_QUERY_KEY, ALL_BOMS_QUERY_KEY, PRODUCTS_QUERY_KEY])
            toast.success('Lista de Materiales eliminada')
        },
        onError: () => toast.error('Error al eliminar Lista de Materiales'),
    })
}

export function useBOMs(params: { product_id?: string | number, parent_id?: string | number }) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: boms, isLoading: isBOMsLoading, refetch } = useQuery({
        queryKey: [...BOMS_QUERY_KEY, params],
        queryFn: async (): Promise<BOM[]> => {
            const res = await api.get('/production/boms/', { params })
            return res.data.results
        },
        staleTime: 5 * 60 * 1000, // 5 min
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/production/boms/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [BOMS_QUERY_KEY, PRODUCTS_QUERY_KEY])
            toast.success('Lista de Materiales eliminada')
        },
        onError: () => toast.error('Error al eliminar Lista de Materiales')
    })

    const toggleActiveMutation = useMutation({
        mutationFn: (id: number) => api.patch(`/production/boms/${id}/`, { active: true }),
        onSuccess: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [BOMS_QUERY_KEY, PRODUCTS_QUERY_KEY])
            toast.success('Lista de Materiales establecida como activa')
        },
        onError: () => toast.error('Error al actualizar estado')
    })

    return {
        boms: boms ?? [],
        isBOMsLoading,
        refetch,
        deleteBom: deleteMutation.mutateAsync,
        toggleActive: toggleActiveMutation.mutateAsync,
    }
}

export function useAllBOMs(filters?: FilterState, initialData?: BOM[]) {
    const query = useQuery({
        queryKey: [...ALL_BOMS_QUERY_KEY, filters],
        queryFn: async (): Promise<BOM[]> => {
            const params = new URLSearchParams()
            if (filters?.search) params.append('search', filters.search)
            if (filters?.active !== undefined) params.append('active', filters.active)
            const res = await api.get<{ results: BOM[] }>('/production/boms/', { params })
            return res.data.results
        },
        staleTime: 5 * 60 * 1000,
        initialData,
        placeholderData: (prev) => prev,
    })

    const boms = query.data ?? []
    const showSkeleton = query.isLoading && !boms.length
    const refetch = query.refetch
    const isRefetching = query.isFetching && !showSkeleton

    return { boms, isLoading: showSkeleton, isRefetching, refetch }
}

export function useProductionVariants(parentId: number | string | undefined) {
    const { data: variants, isLoading: isVariantsLoading } = useQuery({
        queryKey: [...VARIANTS_QUERY_KEY, parentId],
        queryFn: async (): Promise<ProductMinimal[]> => {
            if (!parentId) return []
            const res = await api.get<{ results: ProductMinimal[] }>(`/inventory/products/?parent_template=${parentId}&show_technical_variants=true`)
            return res.data.results
        },
        staleTime: 5 * 60 * 1000,
    })

    return { variants: variants ?? [], isVariantsLoading }
}
