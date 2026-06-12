import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'
import type { FilterState } from '@/components/shared'

export interface UoMCategory {
    id: number
    name: string
}

export interface UoM {
    id: number
    name: string
    category: number
    category_name: string
    uom_type: 'REFERENCE' | 'BIGGER' | 'SMALLER'
    ratio: string
    rounding: string
    is_active: boolean
}

export type UoMCategoryPayload = Omit<UoMCategory, 'id'>

// ─── Hierarchical query keys ──────────────────────────────────────────────────

export const UOMS_KEYS = {
    all: ['uoms'] as const,
    lists: () => [...UOMS_KEYS.all, 'list'] as const,
    details: () => [...UOMS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...UOMS_KEYS.details(), id] as const,
}

export const UOM_CATEGORIES_KEYS = {
    all: ['uomCategories'] as const,
    lists: () => [...UOM_CATEGORIES_KEYS.all, 'list'] as const,
}

/** @deprecated Use UOMS_KEYS.* / UOM_CATEGORIES_KEYS.* */
export const UOMS_QUERY_KEY = UOMS_KEYS.all
/** @deprecated */
export const UOM_CATEGORIES_QUERY_KEY = UOM_CATEGORIES_KEYS.all

/**
 * Endpoint `/inventory/uoms/allowed/?product_id=<id>&context=<sale|purchase>`.
 * Devuelve sólo las UoMs permitidas para vender/comprar el producto, ya
 * filtradas por restricciones del producto (allowed_sale_uoms, etc.).
 */
export function useAllowedUoMs(productId: number | string | null | undefined, context: 'sale' | 'purchase') {
    return useQuery<{ id: number, name: string }[]>({
        queryKey: productId
            ? [...UOMS_KEYS.all, 'allowed', context, productId]
            : [...UOMS_KEYS.all, 'allowed', context, 'noop'],
        queryFn: async () => {
            const res = await api.get<{ id: number, name: string }[]>(
                `/inventory/uoms/allowed/?product_id=${productId}&context=${context}`,
            )
            return res.data
        },
        enabled: !!productId,
        staleTime: 30 * 60 * 1000, // 30 min — datos quasi-estáticos por producto
    })
}

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useUoMs(filters?: FilterState) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: uoms, isLoading: isUoMsLoading, refetch } = useQuery({
        queryKey: [...UOMS_KEYS.all, filters],
        queryFn: async (): Promise<UoM[]> => {
            const params = new URLSearchParams()
            if (filters?.search) params.append('search', filters.search)
            // Filtro por categoría (uom_category de un producto). FilterState
            // no lo declara pero el backend lo acepta — leemos como índice.
            const categoryFilter = (filters as unknown as { category?: number | string } | undefined)?.category
            if (categoryFilter !== undefined && categoryFilter !== null && categoryFilter !== '') {
                params.append('category', String(categoryFilter))
            }
            const response = await api.get('/inventory/uoms/', { params })
            return response.data
        },
        staleTime: 60 * 60 * 1000, // 1 hora — datos estáticos
    })

    const { data: categories, isLoading: isCategoriesLoading } = useQuery({
        queryKey: UOM_CATEGORIES_KEYS.all,
        queryFn: async (): Promise<UoMCategory[]> => {
            const response = await api.get<UoMCategory[]>('/inventory/uom-categories/')
            return response.data
        },
        staleTime: 60 * 60 * 1000, // 1 hora — datos estáticos
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/uoms/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: UOMS_KEYS.all })
        },
    })

    const saveMutation = useMutation({
        mutationFn: async (uom: Partial<UoM>) => {
            const res = uom.id
                ? await api.put<UoM>(`/inventory/uoms/${uom.id}/`, uom)
                : await api.post<UoM>('/inventory/uoms/', uom)
            return res.data
        },
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: UOMS_KEYS.all })
        },
    })

    const saveCategoryMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: UoMCategoryPayload }) => {
            const res = id !== null
                ? await api.put<UoMCategory>(`/inventory/uom-categories/${id}/`, payload)
                : await api.post<UoMCategory>('/inventory/uom-categories/', payload)
            return res.data
        },
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Categoría creada' : 'Categoría actualizada')
            // Cambia el conjunto de categorías Y puede afectar `category_name`
            // en cada UoM derivada → invalidar ambos.
            queryClient.invalidateQueries({ queryKey: UOM_CATEGORIES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: UOMS_KEYS.all })
        },
    })

    const deleteCategoryMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/uom-categories/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Categoría eliminada')
            queryClient.invalidateQueries({ queryKey: UOM_CATEGORIES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: UOMS_KEYS.all })
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar la categoría: ${e.message}`)
        },
    })

    return {
        uoms: uoms ?? [],
        categories: categories ?? [],
        isLoading: isUoMsLoading || isCategoriesLoading,
        isUoMsLoading,
        refetch,
        deleteUoM: deleteMutation.mutateAsync,
        saveUoM: saveMutation.mutateAsync,
        isSaving: saveMutation.isPending,
        saveUoMCategory: saveCategoryMutation.mutateAsync,
        isSavingCategory: saveCategoryMutation.isPending,
        deleteUoMCategory: deleteCategoryMutation.mutateAsync,
    }
}
