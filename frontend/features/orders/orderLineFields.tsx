import { createEntityFields } from '@/components/shared'
import { OrderLineProductLink, OrderLineWorkOrderLink } from './components/sheet/OrderLineLinks'
import type { OrderLine } from './types'

/**
 * Productos de OV/OC en la ficha documental (ADR-0083, invariante 13). Precios y subtotales
 * netos (sin IVA); entregado/recibido y facturado (ADR-0081) como cantidades.
 * Producto y OT abren su ficha apilada sobre la orden.
 */
export const orderLineFields = createEntityFields<OrderLine>()({
    product: {
        key: 'product_name',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'Producto',
        tableOptions: { align: 'left' },
        render: (l) => <OrderLineProductLink line={l} />,
    },
    quantity: {
        key: 'quantity',
        type: 'number',
        label: 'Cantidad',
        suffix: (l) => String(l.uom_name ?? l.unit_name ?? ''),
        tableOptions: { align: 'right' },
    },
    unit_price: {
        key: 'unit_price',
        type: 'currency',
        label: 'Precio unit. (neto)',
        get: (l) => l.unit_price ?? l.price_unit,
        tableOptions: { align: 'right' },
    },
    delivered: {
        key: 'quantity_delivered',
        type: 'number',
        label: 'Entregado',
        get: (l) => l.quantity_delivered ?? l.quantity_received ?? l.delivered_quantity ?? l.received_quantity ?? 0,
        tableOptions: { align: 'right' },
    },
    invoiced: {
        key: 'quantity_invoiced',
        type: 'number',
        label: 'Facturado',
        get: (l) => l.quantity_invoiced ?? 0,
        tableOptions: { align: 'right' },
    },
    work_order: {
        key: 'work_order_summary',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'OT',
        tableOptions: { align: 'left' },
        render: (l) => <OrderLineWorkOrderLink line={l} />,
    },
    // Subtotal al final: es el resultado de la fila
    subtotal: { key: 'subtotal', type: 'currency', label: 'Subtotal (neto)', tableOptions: { align: 'right' } },
})
