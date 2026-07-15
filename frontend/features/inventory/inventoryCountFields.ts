import { createEntityFields } from '@/components/shared'
import type { InventoryCount } from '@/features/inventory/types'

export const inventoryCountFields = createEntityFields<InventoryCount>()({
    id: { key: 'id', type: 'code', label: 'Folio', get: (row) => `#${row.id}` },
    warehouse_name: { key: 'warehouse_name', type: 'text', label: 'Almacén' },
    status: { key: 'status', type: 'status', label: 'Estado', tableOptions: { width: 120 } },
    created_by_name: { key: 'created_by_name', type: 'secondary', label: 'Creado por', tableOptions: { width: 150 } },
})
