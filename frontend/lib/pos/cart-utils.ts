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
export function calculateCartTotals(items: CartItem[], totalDiscount: number = 0) {
    const total_gross_before_global_discount = items.reduce((acc, i) => acc + i.total_gross, 0)
    const line_discounts_sum = items.reduce((acc, i) => acc + (i.discount_amount || 0), 0)
    const total_gross_sum = Math.max(0, total_gross_before_global_discount - totalDiscount)
    const total_net_sum = Math.round(total_gross_sum / 1.19)
    const total_tax_sum = total_gross_sum - total_net_sum

    return {
        total_gross: total_gross_sum,
        total_net: total_net_sum,
        total_tax: total_tax_sum,
        total_gross_before_discount: total_gross_before_global_discount,
        total_discount: line_discounts_sum + totalDiscount
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
    discountPercentage: number = 0,
    discountAmount: number = 0,
    manufacturingData?: any
): CartItem {
    const linePricing = PricingUtils.calculateLineFromGross(qty, priceGross, discountAmount);

    return {
        ...product,
        cartItemId: generateCartItemId(),
        qty,
        uom: uomId,
        uom_name: uomName,
        unit_price_net: priceNet,
        unit_price_gross: priceGross,
        discount_percentage: discountPercentage,
        discount_amount: discountAmount,
        total_net: linePricing.net,
        total_gross: linePricing.gross,
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
    newPriceGross: number,
    newDiscountPercentage: number = 0,
    newDiscountAmount: number = 0
): CartItem {
    const linePricing = PricingUtils.calculateLineFromGross(newQty, newPriceGross, newDiscountAmount);

    return {
        ...item,
        qty: newQty,
        unit_price_net: newPriceNet,
        unit_price_gross: newPriceGross,
        discount_percentage: newDiscountPercentage,
        discount_amount: newDiscountAmount,
        total_net: linePricing.net,
        total_gross: linePricing.gross
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
