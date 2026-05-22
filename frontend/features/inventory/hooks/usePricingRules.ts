import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { FilterState } from '@/components/shared'
import { useRealtime } from '@/features/realtime'
import { PRODUCTS_QUERY_KEY } from './queryKeys'

export interface PricingRule {
    id: number
    name: string
    product?: number
    product_name?: string
    category?: number
    category_name?: string
    uom?: number
    uom_name?: string
    product_code?: string
    product_internal_code?: string | null
    operator: "BT" | "GT" | "LT" | "EQ" | "GE" | "LE"
    operator_display: string
    min_quantity: string
    max_quantity?: string
    rule_type: "FIXED" | "DISCOUNT_PERCENTAGE"
    rule_type_display: string
    fixed_price?: string
    discount_percentage?: string
    start_date?: string
    end_date?: string
    priority: number
    active: boolean
}

export const PRICING_RULES_QUERY_KEY = ['pricingRules']

export function usePricingRules(filters?: FilterState) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: rules, isLoading, refetch } = useQuery({
        queryKey: [...PRICING_RULES_QUERY_KEY, filters],
        queryFn: async (): Promise<PricingRule[]> => {
            const params = new URLSearchParams()
            if (filters?.search) params.append('search', filters.search)
            if (filters?.active !== undefined) params.append('active', filters.active)
            const response = await api.get('/inventory/pricing-rules/', { params })
            return response.data.results || response.data
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return api.delete(`/inventory/pricing-rules/${id}/`)
        },
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: PRICING_RULES_QUERY_KEY })
            // A deleted rule can change computed prices shown in the product list
            queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
        },
    })

    return {
        rules: rules ?? [],
        isLoading,
        refetch,
        deletePricingRule: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending
    }
}

/**
 * Pricing rules scoped to a single product. Returns null/empty while the
 * productId is missing (creating a new product, before save).
 *
 * El queryKey usa el formato product-aware [PRICING_RULES_QUERY_KEY, 'byProduct', id]
 * de modo que las invalidaciones masivas de PRICING_RULES_QUERY_KEY también
 * lo cubren, y las mutaciones de un producto pueden invalidar selectivamente
 * sólo este sub-conjunto si fuera necesario.
 */
export function useProductPricingRules(productId: number | null | undefined) {
    const { data: rules, isLoading, refetch } = useQuery({
        queryKey: productId
            ? [...PRICING_RULES_QUERY_KEY, 'byProduct', productId]
            : [...PRICING_RULES_QUERY_KEY, 'byProduct', 'noop'],
        queryFn: async (): Promise<PricingRule[]> => {
            if (!productId) return []
            const response = await api.get(`/inventory/pricing-rules/?product=${productId}`)
            return response.data.results || response.data
        },
        enabled: !!productId,
    })

    return {
        rules: rules ?? [],
        isLoading,
        refetch,
    }
}
