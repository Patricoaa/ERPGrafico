import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inventoryApi } from '../api/inventoryApi'
import { useRealtime } from '@/features/realtime'
import type { ProductFilters, ProductUpdatePayload } from '../types'
import { BOMS_QUERY_KEY, PRODUCTS_KEYS, PRODUCTS_QUERY_KEY } from './queryKeys'

// Re-export for backward compatibility with external consumers that still
// import the flat constant directly (production/useBOMs, usePricingRules).
export { PRODUCTS_QUERY_KEY, PRODUCTS_KEYS }

interface UseProductsProps {
    filters?: ProductFilters
}

export function useProducts({ filters }: UseProductsProps = {}) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: products, isLoading, refetch } = useQuery({
        queryKey: PRODUCTS_KEYS.list(filters),
        queryFn: () => inventoryApi.getProducts(filters),
    })

    const invalidateProductsAndBoms = () => {
        // Cover both list AND detail queries — invalidating `PRODUCTS_KEYS.all`
        // hits every descendant (list, detail, and any future sub-resources).
        queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.all })
        // A product change can affect BOMs that reference it (has_bom flag,
        // component availability). Keep this cross-invalidation explicit.
        queryClient.invalidateQueries({ queryKey: BOMS_QUERY_KEY })
    }

    const updateProductMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number, payload: ProductUpdatePayload }) =>
            inventoryApi.updateProduct(id, payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateProductsAndBoms()
        },
    })

    const saveProductMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: ProductUpdatePayload | FormData }) =>
            inventoryApi.saveProduct(id, payload),
        onSuccess: (_, vars) => {
            markLocalMutation()
            toast.success(vars.id === null ? 'Producto creado' : 'Producto actualizado')
            invalidateProductsAndBoms()
        },
        // Sin onError genérico aquí — el caller (ProductForm) muestra errores
        // de validación con showApiError, que es más rico que un toast plano.
        // Si mutateAsync rechaza, el .catch() del caller toma el control.
    })

    const deleteProductMutation = useMutation({
        mutationFn: async (id: number) => inventoryApi.deleteProduct(id),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Producto eliminado')
            invalidateProductsAndBoms()
        },
        onError: (e: Error) => {
            toast.error(`Error al eliminar el producto: ${e.message}`)
        },
    })

    return {
        products: products ?? [],
        isLoading,
        refetch,
        updateProduct: updateProductMutation.mutateAsync,
        isUpdating: updateProductMutation.isPending,
        saveProduct: saveProductMutation.mutateAsync,
        isSaving: saveProductMutation.isPending,
        deleteProduct: deleteProductMutation.mutateAsync,
        isDeleting: deleteProductMutation.isPending,
    }
}

/**
 * Fetch a single product by id. Returns `null` while loading or when id is null.
 * Use this in detail panels, modals and forms that need to display one product.
 */
export function useProduct(id: number | null | undefined) {
    return useQuery({
        queryKey: id ? PRODUCTS_KEYS.detail(id) : ['products', 'detail', 'noop'],
        queryFn: () => inventoryApi.getProduct(id!),
        enabled: !!id,
    })
}

/**
 * Fetch the insights bundle (price history, kardex, sales analysis,
 * production usage) for a product. The shape is consumer-defined via the
 * generic — pass your local `ProductInsights` interface as <T>.
 *
 * queryKey extiende PRODUCTS_KEYS.detail(id) → cualquier mutación del
 * producto invalida también este insights bundle (vía prefix match en
 * PRODUCTS_KEYS.all).
 */
export function useProductInsights<T = unknown>(id: number | null | undefined) {
    return useQuery<T | null>({
        queryKey: id ? [...PRODUCTS_KEYS.detail(id), 'insights'] : ['products', 'insights', 'noop'],
        queryFn: async () => {
            if (!id) return null
            return inventoryApi.getProductInsights<T>(id)
        },
        enabled: !!id,
    })
}
