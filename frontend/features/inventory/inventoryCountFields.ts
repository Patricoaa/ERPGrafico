import { createEntityFields } from '@/components/shared'
import type { InventoryCount } from '@/features/inventory/types'

export const inventoryCountFields = createEntityFields<InventoryCount>()({
    id: { key: 'id', type: 'code', label: 'Folio', get: (row) => `#${row.id}` },
    warehouse_name: { key: 'warehouse_name', type: 'text', label: 'Almacén' },
    status: { key: 'status', type: 'status', label: 'Estado', tableOptions: { width: 120 } },
    created_by_name: { key: 'created_by_name', type: 'secondary', label: 'Creado por', tableOptions: { width: 150 } },
    counted_products: {
        key: 'counted_products',
        type: 'number',
        label: 'Progreso',
    },
    total_products: {
        key: 'total_products',
        type: 'number',
        label: 'Total',
    },
    products_with_difference: {
        key: 'products_with_difference',
        type: 'number',
        label: 'Diferencias',
        get: (c) => c.products_with_difference > 0 ? c.products_with_difference : null,
    },
})
