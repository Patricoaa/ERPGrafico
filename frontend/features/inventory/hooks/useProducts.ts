import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../api/inventoryApi'
import type { ProductFilters, ProductUpdatePayload } from '../types'
import { BOMS_QUERY_KEY, PRODUCTS_QUERY_KEY } from './queryKeys'

// Re-export for backward compatibility with external consumers
export { PRODUCTS_QUERY_KEY }

interface UseProductsProps {
    filters?: ProductFilters
}

export function useProducts({ filters }: UseProductsProps = {}) {
    const queryClient = useQueryClient()

    const { data: products, isLoading, refetch } = useQuery({
        queryKey: [...PRODUCTS_QUERY_KEY, filters],
        queryFn: () => inventoryApi.getProducts(filters),
        staleTime: 5 * 60 * 1000, // 5 min
    })

    const updateProductMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number, payload: ProductUpdatePayload }) => {
            return inventoryApi.updateProduct(id, payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
            // A product change can affect BOMs that reference it (e.g. has_bom flag, component availability)
            queryClient.invalidateQueries({ queryKey: BOMS_QUERY_KEY })
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
