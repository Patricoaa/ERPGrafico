// Validation Utilities
// Validation rules and helpers for POS

import type { CartItem } from '@/types/pos'

/**
 * Validate and sanitize quantity input
 */
export function validateQuantity(qty: number | string): number {
    let newQty = typeof qty === 'string' ? parseFloat(qty) : qty
    if (isNaN(newQty) || newQty < 0.01) newQty = 1
    return newQty
}

/**
 * Validate if cart has items with invalid prices
 */
export function validateCartPrices(items: CartItem[]): { valid: boolean, invalidItems: CartItem[] } {
    const invalidItems = items.filter(i => i.unit_price_net <= 0 || i.unit_price_gross <= 0)
    return {
        valid: invalidItems.length === 0,
        invalidItems
    }
}

/**
 * Check if cart has dynamic pricing products without assigned prices
 */
export function hasDynamicPricingIssues(items: CartItem[], products: any[]): boolean {
    const invalidItems = items.filter(i => {
        const original = products.find(p => p.id === i.id)
        return original?.is_dynamic_pricing && (i.unit_price_net <= 0)
    })
    return invalidItems.length > 0
}

/**
 * Validate if cart is ready for checkout
 */
export function validateCheckoutReady(
    items: CartItem[],
    products: any[]
): { valid: boolean, error?: string } {
    if (items.length === 0) {
        return { valid: false, error: 'El carrito está vacío' }
    }

    if (hasDynamicPricingIssues(items, products)) {
        return {
            valid: false,
            error: 'Hay productos con precio dinámico sin asignar (precio 0). Por favor asigne un precio unitario antes de continuar.'
        }
    }

    return { valid: true }
}

/**
 * Validate quick sale eligibility
 */
export function canQuickSale(
    items: CartItem[],
    selectedCustomerId: number | null
): { allowed: boolean, reason: string } {
    // Check if default customer exists
    if (!selectedCustomerId) {
        return { allowed: false, reason: "No hay cliente por defecto configurado" }
    }

    // Check for products with zero price
    const productsWithoutPrice = items.filter(i => i.unit_price_gross <= 0 || i.unit_price_net <= 0)
    if (productsWithoutPrice.length > 0) {
        return { allowed: false, reason: "El carrito contiene productos sin precio asignado" }
    }

    // Check for manufacturing products
    const manufacturingProducts = items.filter(i =>
        i.product_type === 'MANUFACTURABLE' || i.requires_advanced_manufacturing
    )
    if (manufacturingProducts.length > 0) {
        return { allowed: false, reason: "El carrito contiene productos que requieren fabricación" }
    }

    return { allowed: true, reason: "" }
}
