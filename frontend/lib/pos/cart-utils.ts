// Cart Utilities
// Helper functions for cart management

import type { CartItem, Product } from '@/types/pos'
import { PricingUtils } from '@/lib/pricing'

/**
 * Generate unique cart item ID
 */
export function generateCartItemId(): string {
    return Math.random().toString(36).substring(2, 9)
}

/**
 * Calculate cart totals
 */
export function calculateCartTotals(items: CartItem[]) {
    const total_gross_sum = items.reduce((acc, i) => acc + i.total_gross, 0)
    const total_net_sum = Math.round(total_gross_sum / 1.19)
    const total_tax_sum = total_gross_sum - total_net_sum

    return {
        total_gross: total_gross_sum,
        total_net: total_net_sum,
        total_tax: total_tax_sum
    }
}

/**
 * Create cart item from product
 */
export function createCartItem(
    product: Product,
    qty: number,
    uomId: number,
    uomName: string | undefined,
    priceNet: number,
    priceGross: number,
    manufacturingData?: any
): CartItem {
    return {
        ...product,
        cartItemId: generateCartItemId(),
        qty,
        uom: uomId,
        uom_name: uomName,
        unit_price_net: priceNet,
        unit_price_gross: priceGross,
        total_net: PricingUtils.calculateLineNet(qty, priceNet),
        total_gross: Math.round(qty * priceGross),
        manufacturing_data: manufacturingData
    }
}

/**
 * Update cart item quantities and prices
 */
export function updateCartItemQuantity(
    item: CartItem,
    newQty: number,
    newPriceNet: number,
    newPriceGross: number
): CartItem {
    return {
        ...item,
        qty: newQty,
        unit_price_net: newPriceNet,
        unit_price_gross: newPriceGross,
        total_net: PricingUtils.calculateLineNet(newQty, newPriceNet),
        total_gross: Math.round(newQty * newPriceGross)
    }
}

/**
 * Check if product can be added to cart
 */
export function canAddToCart(product: Product): { canAdd: boolean, reason?: string } {
    // Check if STORABLE with no stock
    if (product.product_type === 'STORABLE' && (product.current_stock || 0) <= 0) {
        return { canAdd: false, reason: 'Sin stock disponible' }
    }

    // Check if MANUFACTURABLE with 0 quantity
    if (
        product.product_type === 'MANUFACTURABLE' &&
        product.manufacturable_quantity === 0 &&
        product.has_bom
    ) {
        return { canAdd: false, reason: 'No hay componentes disponibles para fabricar' }
    }

    return { canAdd: true }
}
