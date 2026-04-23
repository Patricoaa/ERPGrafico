// BOM Resolver Utilities
// Business logic for fetching and caching Bill of Materials

import type { Product, BOM, BOMCache, ComponentCache } from '@/types/pos'
import api from '@/lib/api'

/**
 * Fetch BOM for a product with caching
 */
export async function fetchBOM(
    productId: number,
    products: Product[],
    bomCache: BOMCache,
    updateBomCache: (productId: number, bom: BOM) => void
): Promise<BOM | null> {
    // Check cache first
    if (bomCache[productId]) return bomCache[productId]

    // Try to find it in the preloaded products list
    const product = products.find(p => p.id === productId)
    if (product && product.boms && product.boms.length > 0) {
        const activeBom = product.boms.find(b => b.active)
        if (activeBom) {
            updateBomCache(productId, activeBom)
            return activeBom
        }
    }

    // Fetch from API
    try {
        const res = await api.get(`/production/boms/?product_id=${productId}&active=true`)
        const boms = res.data.results || res.data
        const activeBom = boms.find((b: BOM) => b.active)
        if (activeBom) {
            updateBomCache(productId, activeBom)
            return activeBom
        }
    } catch (error) {
        console.error(`Error fetching BOM for product ${productId}`, error)
    }

    return null
}

/**
 * Fetch component data (stock and UoM) with caching
 */
export async function fetchComponentData(
    componentId: number,
    products: Product[],
    componentCache: ComponentCache,
    updateComponentCache: (componentId: number, data: { stock: number, uom: number }) => void
): Promise<{ stock: number, uom: number } | null> {
    // Check if component exists in products list
    const internalProd = products.find(p => p.id === componentId)
    if (internalProd) {
        return {
            stock: internalProd.current_stock || 0,
            uom: internalProd.uom || 0
        }
    }

    // Check cache
    if (componentCache[componentId]) return componentCache[componentId]

    // Fetch from API
    try {
        const res = await api.get(`/inventory/products/${componentId}/`)
        const data = {
            stock: res.data.current_stock || 0,
            uom: res.data.uom || 0
        }
        updateComponentCache(componentId, data)
        return data
    } catch (error) {
        console.error(`Error fetching data for component ${componentId}`, error)
        return null
    }
}

/**
 * Initialize BOM and component caches from preloaded products
 */
export function initializeCachesFromProducts(
    products: Product[]
): { bomCache: BOMCache, componentCache: ComponentCache } {
    const newBomCache: BOMCache = {}
    const newComponentCache: ComponentCache = {}

    products.forEach((p) => {
        if (p.boms && p.boms.length > 0) {
            const activeBom = p.boms.find(b => b.active)
            if (activeBom) {
                newBomCache[p.id] = activeBom
                // Also pre-cache component stock from BOM lines
                activeBom.lines?.forEach((line) => {
                    if (line.component && line.component_stock !== undefined) {
                        newComponentCache[line.component] = {
                            stock: line.component_stock || 0,
                            uom: line.uom || 0
                        }
                    }
                })
            }
        }
    })

    return { bomCache: newBomCache, componentCache: newComponentCache }
}
