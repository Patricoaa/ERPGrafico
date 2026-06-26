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
            const response = await api.get<PricingRule[]>('/inventory/pricing-rules/', { params })
            // eslint-disable-next-line pagination/no-raw-response-data -- master data, no pagination
            return response.data
        },
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: PRICING_RULES_QUERY_KEY })
        // Pricing rule mutations cambian precios computados → invalidar products.
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
    }

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => api.delete(`/inventory/pricing-rules/${id}/`),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    const saveMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number | null, payload: Record<string, unknown> }) => {
            const res = id !== null
                ? await api.put<PricingRule>(`/inventory/pricing-rules/${id}/`, payload)
                : await api.post<PricingRule>('/inventory/pricing-rules/', payload)
            return res.data
        },
        onSuccess: () => {
            markLocalMutation()
            invalidate()
        },
    })

    return {
        rules: rules ?? [],
        isLoading,
        refetch,
        deletePricingRule: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,
        savePricingRule: saveMutation.mutateAsync,
        isSaving: saveMutation.isPending,
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
            const response = await api.get<PricingRule[]>(`/inventory/pricing-rules/?product=${productId}`)
            // eslint-disable-next-line pagination/no-raw-response-data -- master data, no pagination
            return response.data
        },
        enabled: !!productId,
    })

    return {
        rules: rules ?? [],
        isLoading,
        refetch,
    }
}
