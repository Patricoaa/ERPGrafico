import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../api/inventoryApi'
import type { ProductFilters, ProductUpdatePayload } from '../types'

export const PRODUCTS_QUERY_KEY = ['products']

interface UseProductsProps {
    filters?: ProductFilters
}

export function useProducts({ filters }: UseProductsProps = {}) {
    const queryClient = useQueryClient()

    const { data: products, isLoading, refetch } = useQuery({
        queryKey: [...PRODUCTS_QUERY_KEY, filters],
        queryFn: () => inventoryApi.getProducts(filters),
    })

    const updateProductMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number, payload: ProductUpdatePayload }) => {
            return inventoryApi.updateProduct(id, payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
        },
    })

    return {
        products: products ?? [],
        isLoading,
        refetch,
        updateProduct: updateProductMutation.mutateAsync,
        isUpdating: updateProductMutation.isPending
    }
}
