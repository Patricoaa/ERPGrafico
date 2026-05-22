import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useRealtime } from '@/features/realtime'

export interface Category {
    id: number
    name: string
    parent: number | null
    parent_name: string | null
    asset_account: number | null
    income_account: number | null
    expense_account: number | null
    icon?: string
}

export type CategoryPayload = Omit<Category, 'id' | 'parent_name'>

// ─── Hierarchical query keys ──────────────────────────────────────────────────

export const CATEGORIES_KEYS = {
    all: ['categories'] as const,
    lists: () => [...CATEGORIES_KEYS.all, 'list'] as const,
    list: () => [...CATEGORIES_KEYS.lists()] as const,
    details: () => [...CATEGORIES_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...CATEGORIES_KEYS.details(), id] as const,
}

/** @deprecated Use CATEGORIES_KEYS.* factory instead. */
export const CATEGORIES_QUERY_KEY = CATEGORIES_KEYS.all

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useCategories() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: categories, isLoading, refetch } = useQuery({
        queryKey: CATEGORIES_KEYS.list(),
        queryFn: async (): Promise<Category[]> => {
            const response = await api.get('/inventory/categories/')
            return response.data.results || response.data
        },
        staleTime: 15 * 60 * 1000, // 15 min — datos quasi-estáticos
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: CATEGORIES_KEYS.all })
    }

    const saveCategoryMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: Partial<CategoryPayload> | FormData }) => {
            const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData
            const config = isFormData
                ? { headers: { 'Content-Type': 'multipart/form-data' as const } }
                : undefined
            const res = id !== null
                ? await api.put<Category>(`/inventory/categories/${id}/`, payload, config)
                : await api.post<Category>('/inventory/categories/', payload, config)
            return res.data
        },
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Categoría creada' : 'Categoría actualizada')
            invalidate()
        },
    })

    const deleteCategoryMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/categories/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Categoría eliminada')
            invalidate()
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar la categoría: ${e.message}`)
        },
    })

    return {
        categories: categories ?? [],
        isLoading,
        refetch,
        saveCategory: saveCategoryMutation.mutateAsync,
        isSaving: saveCategoryMutation.isPending,
        deleteCategory: deleteCategoryMutation.mutateAsync,
        isDeleting: deleteCategoryMutation.isPending,
    }
}

/**
 * Fetch a single category by id. Returns null while loading or when id is null.
 */
export function useCategory(id: number | null | undefined) {
    return useQuery({
        queryKey: id ? CATEGORIES_KEYS.detail(id) : ['categories', 'detail', 'noop'],
        queryFn: async (): Promise<Category> => {
            const res = await api.get<Category>(`/inventory/categories/${id!}/`)
            return res.data
        },
        enabled: !!id,
    })
}
