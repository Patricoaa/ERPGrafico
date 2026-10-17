import { createEntityFields } from '@/components/shared'
import { DocumentRefLink } from '@/features/documents'
import type { InventoryDocumentDetail } from './types'

/**
 * Detalle de un documento de inventario en su ficha documental (ADR-0083, invariante 13).
 * `placement: 'detail'` mantiene el orden definido.
 */
export const inventoryDocumentDetailFields = createEntityFields<InventoryDocumentDetail>()({
    product: {
        key: 'product_name',
        placement: 'detail',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'Producto',
        tableOptions: { align: 'left' },
        render: (d) => <DocumentRefLink label="inventory.product" id={d.product} display={d.product_name} mono={false} />,
    },
    warehouse: {
        key: 'warehouse_name',
        placement: 'detail',
        type: 'text',
        label: 'Bodega',
        get: (d) => (d.source_warehouse_name ? `${d.source_warehouse_name} → ${d.warehouse_name}` : d.warehouse_name),
        tableOptions: { align: 'left' },
    },
    quantity: {
        key: 'quantity',
        placement: 'detail',
        type: 'number',
        label: 'Cantidad',
        suffix: (d) => d.uom_name ?? '',
        tableOptions: { align: 'right' },
    },
    unit_cost: {
        key: 'unit_cost',
        placement: 'detail',
        type: 'currency',
        label: 'Costo unit.',
        tableOptions: { align: 'right' },
    },
})
