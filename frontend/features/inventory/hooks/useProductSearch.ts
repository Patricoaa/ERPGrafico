import { useState, useCallback } from "react"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"
import { Product } from "@/types/entities"

interface ProductSearchParams {
    search?: string
    productType?: string
    limit?: number
    context?: 'sale' | 'purchase'
    excludeVariantTemplates?: boolean
    fetchSingleId?: string | number | null
}

interface UseProductSearchReturn {
    products: Product[]
    singleProduct: Product | null
    loading: boolean
    fetchProducts: (params?: ProductSearchParams) => Promise<void>
    fetchSingleProduct: (id: string | number) => Promise<void>
}

const globalCache: Record<string, Product[]> = {}

export function useProductSearch(): UseProductSearchReturn {
    const [products, setProducts] = useState<Product[]>([])
    const [singleProduct, setSingleProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(false)

    // Variant resolver uses an internal cache to avoid hitting endpoints repeatedly
    const resolveVariants = async (productList: Product[], limit?: number) => {
        const resolved = [...productList]
        const itemsToResolve = limit ? resolved.slice(0, limit) : resolved

        await Promise.all(itemsToResolve.map(async (p, idx) => {
            // Only fetch if they have variants flag but the list is missing/empty
            // AND the endpoint is really needed (usually the serializer already provides them)
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

    const fetchSingleProduct = useCallback(async (id: string | number) => {
        try {
            const res = await api.get(`/inventory/products/${id}/`)
            setSingleProduct(res.data)
        } catch (e) {
            console.error("Error fetching single product", e)
        }
    }, [])

    const fetchProducts = useCallback(async (params: ProductSearchParams = {}) => {
        const { search = "", productType, limit = 20, context, excludeVariantTemplates } = params
        const cacheKey = JSON.stringify(params)
        
        if (globalCache[cacheKey]) {
            setProducts(globalCache[cacheKey])
            return
        }

        try {
            setLoading(true)
            const q = new URLSearchParams()
            if (search) q.append("search", search)
            q.append("parent_template__isnull", "true") // Only base products
            
            if (productType) q.append("product_type", productType)
            
            if (context === 'sale') {
                q.append('can_be_sold', 'true')
            } else if (context === 'purchase') {
                q.append('can_be_purchased', 'true')
                if (excludeVariantTemplates) {
                    q.append('exclude_variant_templates', 'true')
                }
            }
            
            const res = await api.get(`/inventory/products/?${q.toString()}`)
            const data = await resolveVariants(res.data.results || res.data, limit)
            
            globalCache[cacheKey] = data
            setProducts(data)
        } catch (err) {
            showApiError(err, "Error al buscar productos")
            setProducts([])
        } finally {
            setLoading(false)
        }
    }, [])

    return { products, singleProduct, loading, fetchProducts, fetchSingleProduct }
}
