import type { Product } from '@/types/pos'

/** 
 * Determina si un producto está deshabilitado para su venta directa en el POS 
 * basado en sus reglas de manufactura o stock disponible.
 */
export function isPOSProductDisabled(product: Product): boolean {
    const isManufacturable = product.product_type === 'MANUFACTURABLE'
    
    if (product.product_type === 'STORABLE') {
        return (product.qty_available ?? 0) <= 0
    }
    
    if (isManufacturable) {
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
