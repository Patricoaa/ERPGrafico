import api from '@/lib/api'
import type { Product, ProductFilters, ProductUpdatePayload } from '../types'

/**
 * Centralized API service for inventory operations
 */
export const inventoryApi = {
    /**
     * Fetch products with optional filtering
     */
    getProducts: async (filters?: ProductFilters): Promise<Product[]> => {
        const params = new URLSearchParams()
        if (filters?.active) params.append('active', filters.active)
        if (filters?.parent_template__isnull !== undefined) params.append('parent_template__isnull', String(filters.parent_template__isnull))

        const { data } = await api.get<{ results: Product[] }>('/inventory/products/', { params })
        return data.results || data
    },

    /**
     * Update a product (partial update)
     */
    updateProduct: async (id: number, payload: ProductUpdatePayload): Promise<Product> => {
        const { data } = await api.patch<Product>(`/inventory/products/${id}/`, payload)
        return data
    },
}
