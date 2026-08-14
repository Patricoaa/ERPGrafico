import type { Product } from '../types'

/** 
 * Determina si un producto está deshabilitado para su venta directa en el POS 
 * basado en sus reglas de manufactura o stock disponible.
 */
export function isPOSProductDisabled(product: Product): boolean {
    // Templates with variants are only launchers for the variant modal;
    // availability is evaluated per variant inside the modal.
    if (product.has_variants) return false

    const isManufacturable = product.product_type === 'MANUFACTURABLE'

    if (product.product_type === 'STORABLE') {
        return (product.qty_available ?? 0) <= 0
    }

    if (isManufacturable) {
        // Defense: without the manufacturing flags we can't tell EXPRESS/ADVANCED
        // apart from SIMPLE. Fail open instead of disabling the whole catalog.
        if (product.requires_advanced_manufacturing === undefined
            && product.mfg_auto_finalize === undefined
            && product.has_bom === undefined) {
            return false
        }

        const mfgSubType = product.requires_advanced_manufacturing ? 'ADVANCED'
            : product.mfg_auto_finalize ? 'EXPRESS' : 'SIMPLE'

        if (mfgSubType === 'SIMPLE') {
            return (product.qty_available ?? 0) <= 0
        }

        if (mfgSubType === 'EXPRESS') {
            return !product.has_bom || (product.manufacturable_quantity ?? 0) === 0
        }
    }

    // SERVICE, CONSUMABLE, SUBSCRIPTION, ADVANCED MFG → siempre disponibles en UI para proceder
    return false
}
