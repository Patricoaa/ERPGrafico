import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

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

export const CATEGORIES_QUERY_KEY = ['categories']

export function useCategories() {
    const queryClient = useQueryClient()

    const { data: categories, isLoading, refetch } = useQuery({
        queryKey: CATEGORIES_QUERY_KEY,
        queryFn: async (): Promise<Category[]> => {
            const response = await api.get('/inventory/categories/')
            return response.data.results || response.data
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return api.delete(`/inventory/categories/${id}/`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY })
        },
    })

    return {
        categories: categories ?? [],
        isLoading,
        refetch,
        deleteCategory: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending
    }
}
