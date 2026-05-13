import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Product } from '@/types/entities'

export interface ProductSearchParams {
    search?: string
    productType?: string
    limit?: number
    context?: 'sale' | 'purchase'
    excludeVariantTemplates?: boolean
    fetchSingleId?: string | number | null
}

export const PRODUCT_KEYS = {
    all: ['products'] as const,
    search: (params: ProductSearchParams) => [...PRODUCT_KEYS.all, 'search', params] as const,
    detail: (id: string | number) => [...PRODUCT_KEYS.all, 'detail', id] as const,
}

const resolveVariants = async (productList: Product[], limit?: number): Promise<Product[]> => {
    const resolved = [...productList]
    const itemsToResolve = limit ? resolved.slice(0, limit) : resolved

    await Promise.all(itemsToResolve.map(async (p, idx) => {
        if (p.has_variants && (!p.variants || p.variants.length === 0)) {
            try {
                const res = await api.get(`/inventory/products/${p.id}/variants/`)
                resolved[idx] = { ...p, variants: res.data }
            } catch (e) {
                console.error("Failed to fetch variants for", p.name, e)
            }
        }
    }))

    return resolved
}

export function useProductSearch(params: ProductSearchParams = {}, enabled: boolean = true) {
    const { search = "", productType, limit = 20, context, excludeVariantTemplates } = params

    const query = useQuery({
        queryKey: PRODUCT_KEYS.search({ search, productType, limit, context, excludeVariantTemplates }),
        queryFn: async ({ signal }) => {
            const q = new URLSearchParams()
            if (search) q.append("search", search)
            q.append("parent_template__isnull", "true")

            if (productType) q.append("product_type", productType)

            if (context === 'sale') {
                q.append('can_be_sold', 'true')
            } else if (context === 'purchase') {
                q.append('can_be_purchased', 'true')
                if (excludeVariantTemplates) {
                    q.append('exclude_variant_templates', 'true')
                }
            }

            const res = await api.get(`/inventory/products/?${q.toString()}`, { signal })
            const results = (res.data.results || res.data) as Product[]
            
            return await resolveVariants(results, limit)
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        products: query.data ?? [],
        loading: query.isLoading,
        isFetching: query.isFetching,
    }
}

export function useSingleProduct(id: string | number | null) {
    const query = useQuery({
        queryKey: PRODUCT_KEYS.detail(id!),
        queryFn: async ({ signal }) => {
            const res = await api.get(`/inventory/products/${id}/`, { signal })
            return res.data as Product
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        product: query.data ?? null,
        loading: query.isLoading,
    }
}
