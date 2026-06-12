import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { BaseProduct } from '@/features/inventory/types'

export interface UseVariantsOptions {
    productId?: number
    enabled?: boolean
    /**
     * When false, includes archived (is_active=false) variants.
     * Default: true (POS/sales selection scenarios want active-only).
     * ProductVariantsTab admin uses `false` to display archived variants too.
     */
    activeOnly?: boolean
    /**
     * Optional extra params, e.g., pos_session_id
     */
    extraParams?: Record<string, string | number | boolean>
}

/**
 * Fetch variants for a given product template.
 */
export function useVariants({ productId, enabled = true, activeOnly = true, extraParams = {} }: UseVariantsOptions = {}) {
    return useQuery({
        queryKey: ['inventory', 'variants', productId, { activeOnly, ...extraParams }],
        queryFn: async () => {
            if (!productId) return []
            const params = new URLSearchParams()
            params.append('parent_template', productId.toString())
            params.append('show_technical_variants', 'true')
            if (activeOnly) {
                params.append('is_active', 'true')
            }

            Object.entries(extraParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, value.toString())
                }
            })

            const res = await api.get<{ results?: BaseProduct[] } | BaseProduct[]>(`/inventory/products/?${params.toString()}`)
            
            if ('results' in res.data && Array.isArray(res.data.results)) {
                return res.data.results
            }
            if (Array.isArray(res.data)) {
                return res.data
            }
            return []
        },
        enabled: enabled && !!productId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })
}
