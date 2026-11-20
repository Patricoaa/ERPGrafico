import type { Product } from '../types'

/**
 * Determina si un producto está deshabilitado para su venta directa en el POS
 * basado en sus reglas de manufactura o stock disponible.
 *
 * Segmentos de MANUFACTURABLE (no existe un subtipo "SIMPLE"):
 *   - EXPRESS  (mfg_auto_finalize && !requires_advanced_manufacturing):
 *       Requiere BOM y componentess disponibles (manufacturable_quantity > 0).
 *   - ADVANCED + STOCKED  (requires_advanced_manufacturing && track_inventory):
 *       Bloquea cuando no hay stock terminado en bodega (qty_available <= 0).
 *   - ADVANCED + ON_DEMAND  (requires_advanced_manufacturing && !track_inventory):
 *       Nunca se bloquea; se fabrica contra pedido y el operador evalúa insumos.
 */
export function isPOSProductDisabled(product: Product): boolean {
    // Templates with variants are only launchers for the variant modal;
    // availability is evaluated per variant inside the modal.
    if (product.has_variants) return false

    if (product.product_type === 'STORABLE') {
        return (product.qty_available ?? 0) <= 0
    }

    if (product.product_type === 'MANUFACTURABLE') {
        // Fail-open: manufacturing flags absent → don't disable the whole catalog.
        if (product.requires_advanced_manufacturing === undefined
            && product.mfg_auto_finalize === undefined
            && product.has_bom === undefined) {
            return false
        }

        const isExpress = Boolean(!product.requires_advanced_manufacturing && product.mfg_auto_finalize)
        const isAdvanced = Boolean(product.requires_advanced_manufacturing)

        if (isExpress) {
            // Express products require a BOM and available components.
            return !product.has_bom || (product.manufacturable_quantity ?? 0) <= 0
        }

        // Advanced / Workshop flow:
        // If stocked, block when there is no finished-good stock.
        if (product.track_inventory) {
            return (product.qty_available ?? 0) <= 0
        }

        // Advanced + on-demand: always available; operator handles material.
        return false
    }

    // SERVICE, CONSUMABLE, SUBSCRIPTION → always available
    return false
}
