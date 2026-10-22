import { hashKey, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inventoryApi } from '../api/inventoryApi'
import { useRealtime } from '@/features/realtime'
import type { Product, ProductFilters, ProductUpdatePayload } from '../types'
import type { Page } from '@/lib/pagination'
import { BOMS_QUERY_KEY, PRODUCTS_KEYS, PRODUCTS_QUERY_KEY } from './queryKeys'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { staleTime } from '@/lib/query-config'

// Re-export for backward compatibility with external consumers that still
// import the flat constant directly (production/useBOMs, usePricingRules).
export { PRODUCTS_QUERY_KEY, PRODUCTS_KEYS }

/**
 * Default product list query (first page, templates only, server order). The server-rendered page
 * (`app/(dashboard)/inventory/products/page.tsx`) fetches exactly this, and the list reuses it only for it.
 */
export const DEFAULT_PRODUCT_LIST_QUERY = { parent_template__isnull: true, page: 1, page_size: 50 } as const

/** A server-rendered page plus the exact query it was rendered for. */
export interface InitialProductsQuery {
    page: Page<Product>
    params: ProductFilters & { page: number; page_size: number }
}

interface UseProductsProps {
    filters?: ProductFilters
    /**
     * Server-rendered data, used only while the query matches `initial.params`. TanStack Query
     * would otherwise seed every new key (sort, page, filter) with it and, being fresh, never fetch.
     */
    initial?: InitialProductsQuery
    page?: number
    page_size?: number
}

export function useProducts({ filters, initial, page = 1, page_size = 50 }: UseProductsProps = {}) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const activeFilters = { ...filters, page, page_size }
    const initialData = initial && hashKey([activeFilters]) === hashKey([initial.params]) ? initial.page : undefined

    const query = useQuery({
        queryKey: PRODUCTS_KEYS.list(activeFilters),
        queryFn: () => inventoryApi.getProducts(activeFilters),
        staleTime: staleTime.stable,
        initialData,
        placeholderData: (prev) => prev,
    })

    const products = query.data?.results ?? []
    const showSkeleton = query.isLoading && !products.length
    const isRefetching = query.isFetching && !showSkeleton
    const refetch = query.refetch

    const invalidateProductsAndBoms = () => {
        invalidateCrossFeature(queryClient, [PRODUCTS_KEYS.all, BOMS_QUERY_KEY])
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

    const generateVariantsMutation = useMutation({
        mutationFn: async ({ templateId, selection }: {
            templateId: number
            selection: Array<{ attribute: number, values: number[] }>
        }) => inventoryApi.generateVariants(templateId, selection),
        onSuccess: () => {
            markLocalMutation()
            // Genera N nuevos productos hijos — invalida lista, detalle y BOMs.
            // También invalida las queries de variants (parent_template-filtradas).
            invalidateCrossFeature(queryClient, [PRODUCTS_KEYS.all, BOMS_QUERY_KEY, ['inventory', 'variants']])
        },
    })

    /**
     * Imperative on-demand fetch del detalle. Útil para flujos donde el
     * componente necesita esperar a tener los datos antes de abrir un modal.
     * Reusa el cache de PRODUCTS_KEYS.detail(id) — no dispara red si está fresh.
     */
    const fetchProductById = (id: number) =>
        queryClient.fetchQuery({
            queryKey: PRODUCTS_KEYS.detail(id),
            queryFn: () => inventoryApi.getProduct(id),
        })

    return {
        page: query.data,
        products,
        isLoading: showSkeleton,
        isRefetching,
        /** The list failed to load (the error itself is reported by the API layer). */
        isError: query.isError,
        refetch,
        fetchProductById,
        updateProduct: updateProductMutation.mutateAsync,
        isUpdating: updateProductMutation.isPending,
        saveProduct: saveProductMutation.mutateAsync,
        isSaving: saveProductMutation.isPending,
        deleteProduct: deleteProductMutation.mutateAsync,
        isDeleting: deleteProductMutation.isPending,
        generateVariants: generateVariantsMutation.mutateAsync,
        isGeneratingVariants: generateVariantsMutation.isPending,
    }
}

/**
 * Fetch a single product by id. Returns `null` while loading or when id is null.
 * Use this in detail panels, modals and forms that need to display one product.
 */
export function useProduct(id: number | null | undefined) {
    const { data: product, isLoading, isError } = useQuery({
        queryKey: id ? PRODUCTS_KEYS.detail(id) : ['products', 'detail', 'noop'],
        queryFn: () => inventoryApi.getProduct(id as number),
        staleTime: staleTime.stable,
        enabled: !!id,
    })
    return { product: product ?? null, isLoading, isError }
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
    const { data: insights, isLoading, isError, refetch } = useQuery<T | null>({
        queryKey: id ? [...PRODUCTS_KEYS.detail(id), 'insights'] : ['products', 'insights', 'noop'],
        queryFn: async () => {
            if (!id) return null
            return inventoryApi.getProductInsights<T>(id)
        },
        staleTime: staleTime.stable,
        enabled: !!id,
    })
    return { insights: insights ?? null, isLoading, isError, refetch }
}
