// Stock Calculator Utilities
// Business logic for stock validation and limit calculation

import type { Product, CartItem, BOM, UoM, ComponentCache, BOMCache } from '@/types/pos'
import api from '@/lib/api'

/**
 * Calculate Unit of Measurement conversion factor
 */
export function getConversionFactor(
    fromUomId: number | undefined,
    toUomId: number | undefined,
    uoms: UoM[]
): number {
    if (!fromUomId || !toUomId || fromUomId === toUomId) return 1

    const fromUom = uoms.find(u => u.id === fromUomId)
    const toUom = uoms.find(u => u.id === toUomId)

    if (!fromUom || !toUom || fromUom.category !== toUom.category) return 1

    return (parseFloat(fromUom.ratio || "1") / parseFloat(toUom.ratio || "1"))
}

/**
 * Calculate total consumption of components by cart items
 */
export async function calculateConsumption(
    cartItems: CartItem[],
    products: Product[],
    uoms: UoM[],
    bomCache: BOMCache,
    fetchBOM: (productId: number) => Promise<BOM | null>,
    fetchComponentData: (componentId: number) => Promise<{ stock: number, uom: number } | null>,
    ignoreItemId?: string
): Promise<Record<number, number>> {
    const consumption: Record<number, number> = {}

    for (const item of cartItems) {
        if (ignoreItemId && item.cartItemId === ignoreItemId) continue

        let itemRefUomId = (item as any).uom
        let productDef = products.find(p => p.id === item.id)
        if (productDef) itemRefUomId = productDef.uom

        const itemFactor = getConversionFactor(item.uom, itemRefUomId, uoms)
        const qtyRef = item.qty * itemFactor

        const isManufacturable = (item.product_type === 'MANUFACTURABLE' || item.requires_advanced_manufacturing)
        const hasBom = item.has_bom || (item as any).has_active_bom

        if (isManufacturable && hasBom) {
            let bom = bomCache[item.id]
            if (!bom) bom = await fetchBOM(item.id) as BOM

            if (bom && bom.lines) {
                for (const line of bom.lines) {
                    const neededInLineUom = qtyRef * line.quantity
                    const compData = await fetchComponentData(line.component)
                    if (compData) {
                        const lineToCompFactor = getConversionFactor(line.uom || undefined, compData.uom, uoms)
                        const neededInCompRef = neededInLineUom * lineToCompFactor
                        consumption[line.component] = (consumption[line.component] || 0) + neededInCompRef
                    }
                }
            }
        } else if (item.product_type === 'STORABLE') {
            consumption[item.id] = (consumption[item.id] || 0) + qtyRef
        }
    }

    return consumption
}

/**
 * Calculate maximum quantity available for a product
 */
export async function calculateMaxQty(
    product: Product | CartItem,
    items: CartItem[],
    products: Product[],
    uoms: UoM[],
    bomCache: BOMCache,
    fetchComponentData: (componentId: number) => Promise<{ stock: number, uom: number } | null>,
    calculateConsumption: (items: CartItem[], ignoreItemId?: string) => Promise<Record<number, number>>,
    currentQty: number = 0,
    cartItemId?: string
): Promise<number> {
    const consumption = await calculateConsumption(items, cartItemId)

    let maxQty = Infinity

    const isManufacturable = (product.product_type === 'MANUFACTURABLE' || product.requires_advanced_manufacturing)
    const hasBom = product.has_bom || (product as any).has_active_bom

    const productDef = products.find(p => p.id === product.id)
    if (!productDef && product.product_type === 'STORABLE') return Infinity

    const itemUom = (product as any).uom
    const defUom = productDef ? productDef.uom : itemUom
    const factorToRef = getConversionFactor(itemUom, defUom, uoms)

    if (product.product_type === 'STORABLE') {
        const currentStock = (product as any).current_stock || (productDef ? productDef.current_stock : 0) || 0
        const availableRef = currentStock - (consumption[product.id] || 0)
        maxQty = availableRef / factorToRef
    } else if (isManufacturable && hasBom) {
        const bom = bomCache[product.id]
        if (!bom) return (product.manufacturable_quantity ?? Infinity)

        for (const line of bom.lines) {
            const compData = await fetchComponentData(line.component)
            if (compData) {
                const usedByOthers = consumption[line.component] || 0
                const remainingStock = compData.stock - usedByOthers
                const lineToCompFactor = getConversionFactor(line.uom || undefined, compData.uom, uoms)
                const compNeededPerProductRef = line.quantity * lineToCompFactor

                if (compNeededPerProductRef > 0) {
                    const maxProductRefUnits = remainingStock / compNeededPerProductRef
                    const maxProductUnits = maxProductRefUnits / factorToRef
                    if (maxProductUnits < maxQty) maxQty = maxProductUnits
                }
            }
        }
    }

    return maxQty < 0 ? 0 : Math.floor(maxQty)
}

/**
 * Validate if projected cart items have sufficient stock
 */
export async function validateStock(
    projectedItems: CartItem[],
    products: Product[],
    calculateConsumption: (items: CartItem[]) => Promise<Record<number, number>>,
    fetchComponentData: (componentId: number) => Promise<{ stock: number, uom: number } | null>
): Promise<{ valid: boolean, error?: string }> {
    const consumption = await calculateConsumption(projectedItems)

    for (const [componentIdStr, qtyNeeded] of Object.entries(consumption)) {
        const componentId = parseInt(componentIdStr)
        const data = await fetchComponentData(componentId)

        if (data && qtyNeeded > (data.stock + 0.0001)) { // Add epsilon for float errors
            const prod = products.find(p => p.id === componentId)
            let name = prod?.name
            if (!name) {
                try {
                    const res = await api.get(`/inventory/products/${componentId}/`)
                    name = res.data.name
                } catch (e) {
                    name = `Componente #${componentId}`
                }
            }

            return {
                valid: false,
                error: `Stock insuficiente para ${name}. Necesario: ${parseFloat(qtyNeeded.toFixed(4))}, Disponible: ${parseFloat(data.stock.toFixed(4))}`
            }
        }
    }

    return { valid: true }
}
