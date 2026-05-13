import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { BOM, ProductMinimal } from '../types'

export const BOMS_QUERY_KEY = ['boms']
export const VARIANTS_QUERY_KEY = ['product-variants']

export function useBOMs(params: { product_id?: string | number, parent_id?: string | number }) {
    const queryClient = useQueryClient()

    const { data: boms, isLoading: isBOMsLoading, refetch } = useQuery({
        queryKey: [...BOMS_QUERY_KEY, params],
        queryFn: async (): Promise<BOM[]> => {
            const res = await api.get('/production/boms/', { params })
            return res.data
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/production/boms/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BOMS_QUERY_KEY })
            toast.success('Lista de Materiales eliminada')
        },
        onError: () => toast.error('Error al eliminar Lista de Materiales')
    })

    const toggleActiveMutation = useMutation({
        mutationFn: (id: number) => api.patch(`/production/boms/${id}/`, { active: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BOMS_QUERY_KEY })
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

export function useProductionVariants(parentId: number | string | undefined) {
    const { data: variants, isLoading: isVariantsLoading } = useQuery({
        queryKey: [...VARIANTS_QUERY_KEY, parentId],
        queryFn: async (): Promise<ProductMinimal[]> => {
            if (!parentId) return []
            const res = await api.get(`/inventory/products/?parent_template=${parentId}&show_technical_variants=true`)
            return res.data.results || res.data
        },
    })

    return { variants: variants ?? [], isVariantsLoading }
}
