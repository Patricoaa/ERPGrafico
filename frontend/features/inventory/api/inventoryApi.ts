import api from '@/lib/api'
import type { Product, ProductFilters, ProductUpdatePayload } from '../types'

/**
 * Centralized API service for inventory operations
 */
export const inventoryApi = {
    /**
     * Fetch products with optional filtering
     */
    getProducts: async (filters?: ProductFilters & { page_size?: number, fields?: string }): Promise<Product[]> => {
        const params = new URLSearchParams()
        if (filters?.active !== undefined) {
            // Send 'all' literally so the backend enters the correct branch.
            // An empty string '' would fall through to the default (active=True only).
            const val = filters.active === 'all' ? 'all' : String(filters.active)
            params.append('active', val)
        }
        if (filters?.can_be_sold !== undefined) params.append('can_be_sold', String(filters.can_be_sold))
        if (filters?.can_be_purchased !== undefined) params.append('can_be_purchased', String(filters.can_be_purchased))
        if (filters?.parent_template__isnull !== undefined) params.append('parent_template__isnull', String(filters.parent_template__isnull))
        if (filters?.search) params.append('search', filters.search)
        if (filters?.product_type) params.append('product_type', filters.product_type)
        if (filters?.page_size) params.append('page_size', String(filters.page_size))
        if (filters?.fields) params.append('fields', filters.fields)

        const { data } = await api.get<{ results: Product[] }>('inventory/products/', { params })
        return data.results || data
    },

    /**
     * Update a product (partial update)
     */
    updateProduct: async (id: number, payload: ProductUpdatePayload): Promise<Product> => {
        const { data } = await api.patch<Product>(`inventory/products/${id}/`, payload)
        return data
    },

    /**
     * Fetch product categories
     */
    getCategories: async (): Promise<Array<{ id: number; name: string; icon?: string | null }>> => {
        const { data } = await api.get('inventory/categories/', { params: { page_size: 9999 } })
        return data.results || data
    },
}
