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
     * Fetch a single product by id (detail view).
     */
    getProduct: async (id: number): Promise<Product> => {
        const { data } = await api.get<Product>(`inventory/products/${id}/`)
        return data
    },

    /**
     * Update a product (partial — PATCH). Use for inline edits (toggle active,
     * change a single field). For full-form submits with potential file uploads,
     * use `saveProduct` instead.
     */
    updateProduct: async (id: number, payload: ProductUpdatePayload): Promise<Product> => {
        const { data } = await api.patch<Product>(`inventory/products/${id}/`, payload)
        return data
    },

    /**
     * Create or replace a product. Accepts a JSON payload or FormData (for
     * image uploads). `id === null` → POST (create); otherwise PUT (full
     * replacement). This is the path used by ProductForm.
     */
    saveProduct: async (
        id: number | null,
        payload: ProductUpdatePayload | FormData,
    ): Promise<Product> => {
        const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData
        const config = isFormData
            ? { headers: { 'Content-Type': 'multipart/form-data' as const } }
            : undefined
        const { data } = id !== null
            ? await api.put<Product>(`inventory/products/${id}/`, payload, config)
            : await api.post<Product>('inventory/products/', payload, config)
        return data
    },

    /**
     * Delete a product. Backend is responsible for cascading or refusing
     * if the product is referenced by transactions.
     */
    deleteProduct: async (id: number): Promise<void> => {
        await api.delete(`inventory/products/${id}/`)
    },

    /**
     * Fetch the insights bundle for a product (price history, kardex,
     * sales analysis, production usage). Shape is consumed locally by
     * ProductInsightsModal — typed generically so the caller can refine it.
     */
    getProductInsights: async <T = unknown>(id: number): Promise<T> => {
        const { data } = await api.get<T>(`inventory/products/${id}/insights/`)
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
