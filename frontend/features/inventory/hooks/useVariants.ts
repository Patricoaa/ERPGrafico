import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { BaseProduct } from '@/features/inventory/types'

export interface UseVariantsOptions {
    productId?: number
    enabled?: boolean
    /** 
     * Optional extra params, e.g., pos_session_id 
     */
    extraParams?: Record<string, string | number | boolean>
}

/**
 * Fetch variants for a given product template.
 */
export function useVariants({ productId, enabled = true, extraParams = {} }: UseVariantsOptions = {}) {
    return useQuery({
        queryKey: ['inventory', 'variants', productId, extraParams],
        queryFn: async () => {
            if (!productId) return []
            const params = new URLSearchParams()
            params.append('parent_template', productId.toString())
            params.append('show_technical_variants', 'true')
            params.append('active', 'true')
            
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
