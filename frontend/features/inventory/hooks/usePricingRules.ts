import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
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

export function usePricingRules() {
    const queryClient = useQueryClient()

    const { data: rules, isLoading, refetch } = useQuery({
        queryKey: PRICING_RULES_QUERY_KEY,
        queryFn: async (): Promise<PricingRule[]> => {
            const response = await api.get('/inventory/pricing-rules/')
            return response.data.results || response.data
        },
        staleTime: 5 * 60 * 1000, // 5 min
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return api.delete(`/inventory/pricing-rules/${id}/`)
        },
        onSuccess: () => {
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
