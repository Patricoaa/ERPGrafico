import { createEntityFields } from '@/components/shared'
import { OrderLineProductLink, OrderLineWorkOrderLink } from './components/sheet/OrderLineLinks'
import type { OrderLine } from './types'

/**
 * Productos de OV/OC en la ficha documental (ADR-0083, invariante 13). Precios y subtotales
 * netos (sin IVA): la OV guarda importes brutos y el backend entrega `unit_price_net` y
 * `subtotal_net` (reparto exacto de `total_net`). Entregado/recibido y facturado como cantidades.
 * `placement: 'detail'` en todos: la tabla sigue el orden de definición (Subtotal al final).
 * Producto y OT abren su ficha apilada sobre la orden.
 */
const buildOrderLineFields = (fulfilledLabel: string) => createEntityFields<OrderLine>()({
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
        // OV: neto calculado (gross-first); OC: unit_cost ya es neto
        get: (l) => l.unit_price_net ?? l.unit_cost ?? l.unit_price ?? l.price_unit,
        tableOptions: { align: 'right' },
    },
    delivered: {
        key: 'quantity_delivered',
        placement: 'detail',
        type: 'number',
        label: fulfilledLabel,
        get: (l) => l.quantity_delivered ?? l.quantity_received ?? l.delivered_quantity ?? l.received_quantity ?? 0,
        tableOptions: { align: 'right' },
    },
    invoiced: {
        key: 'quantity_invoiced',
        placement: 'detail',
        type: 'number',
        label: 'Facturado',
        get: (l) => l.quantity_invoiced ?? 0,
        tableOptions: { align: 'right' },
    },
    work_order: {
        key: 'work_order_summary',
        placement: 'detail',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'OT',
        tableOptions: { align: 'left' },
        render: (l) => <OrderLineWorkOrderLink line={l} />,
    },
    // Subtotal al final: es el resultado de la fila
    subtotal: {
        key: 'subtotal_net',
        placement: 'detail',
        type: 'currency',
        label: 'Subtotal (neto)',
        get: (l) => l.subtotal_net ?? l.subtotal,
        tableOptions: { align: 'right' },
    },
})

export const orderLineFields = buildOrderLineFields('Entregado')
/** OC: "Recibido"; sin columna OT (`toColumns({ exclude: ['work_order_summary'] })`). */
export const purchaseOrderLineFields = buildOrderLineFields('Recibido')
