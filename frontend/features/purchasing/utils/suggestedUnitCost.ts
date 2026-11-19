import type { ProductMinimal } from '@/types/entities'

const toNumber = (value: string | number | null | undefined): number => {
    const parsed = typeof value === 'number' ? value : parseFloat(value ?? '')
    return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Costo unitario neto que se propone al agregar un producto a una compra:
 * último precio de compra y, sin historial, el costo del producto.
 */
export function suggestedUnitCost(product: Pick<ProductMinimal, 'last_purchase_price' | 'cost_price'>): number {
    return toNumber(product.last_purchase_price) || toNumber(product.cost_price)
}
