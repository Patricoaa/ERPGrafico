import { createEntityFields } from '@/components/shared'
import type { InventoryCountLine } from '@/features/inventory/types'

export const inventoryCountLineFields = createEntityFields<InventoryCountLine>()({
    product_code: { key: 'product_code', type: 'code', label: 'Código' },
    product_name: { key: 'product_name', type: 'text', label: 'Producto' },
    uom_name: { key: 'uom_name', type: 'secondary', label: 'Unidad', tableOptions: { align: 'center' } },
})
