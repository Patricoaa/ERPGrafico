import { createEntityFields } from '@/components/shared'
import { OrderLineProductLink } from './components/sheet/OrderLineLinks'
import type { OrderLine } from './types'

/**
 * Productos de una factura o nota en la ficha documental (ADR-0083, invariante 13).
 * Importes netos: el backend entrega `unit_price_net`/`subtotal_net` (facturas de venta
 * gross-first con reparto exacto de total_net; compra ya neta). Subtotal al final.
 */
export const invoiceLineFields = createEntityFields<OrderLine>()({
    product: {
        key: 'product_name',
        placement: 'detail',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'Producto',
        tableOptions: { align: 'left' },
        render: (l) => <OrderLineProductLink line={l} />,
    },
    quantity: {
        key: 'quantity',
        placement: 'detail',
        type: 'number',
        label: 'Cantidad',
        suffix: (l) => String(l.uom_name ?? l.unit_name ?? ''),
        tableOptions: { align: 'right' },
    },
    unit_price: {
        key: 'unit_price',
        placement: 'detail',
        type: 'currency',
        label: 'Precio unit. (neto)',
        get: (l) => l.unit_price_net ?? l.unit_cost ?? l.unit_price ?? l.price_unit,
        tableOptions: { align: 'right' },
    },
    subtotal: {
        key: 'subtotal_net',
        placement: 'detail',
        type: 'currency',
        label: 'Subtotal (neto)',
        get: (l) => l.subtotal_net ?? l.subtotal,
        tableOptions: { align: 'right' },
    },
})
