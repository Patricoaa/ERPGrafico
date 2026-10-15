import { createEntityFields, DataCell, QuantityDisplay } from '@/components/shared'
import type { OrderLine } from './types'

const num = (value: unknown) => {
    const n = parseFloat(String(value ?? 0))
    return Number.isFinite(n) ? n : 0
}

/** Avance de una cantidad de la línea ("3 / 5") con el % en tono secundario. */
function Fulfilment({ done, total }: { done: number; total: number }) {
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
    return (
        <span className="inline-flex items-baseline gap-1.5 font-mono text-xs tabular-nums">
            <span className={pct >= 100 ? 'text-success' : pct > 0 ? 'text-warning' : 'text-muted-foreground'}>
                <QuantityDisplay value={done} decimals={2} inline /> / <QuantityDisplay value={total} decimals={2} inline />
            </span>
            <span className="text-3xs text-muted-foreground">{pct}%</span>
        </span>
    )
}

/**
 * Líneas de OV/OC en la ficha documental (ADR-0083, invariante 13). Incluye el avance de
 * entrega/recepción y de facturación por línea (ADR-0081, `quantity_invoiced`).
 */
export const orderLineFields = createEntityFields<OrderLine>()({
    product_code: { key: 'product_code', type: 'code', label: 'Código' },
    product_name: {
        key: 'product_name',
        type: 'text',
        label: 'Producto',
        get: (l) => l.product_name || l.description,
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
        label: 'Precio unit.',
        get: (l) => l.unit_price ?? l.price_unit,
        tableOptions: { align: 'right' },
    },
    subtotal: { key: 'subtotal', type: 'currency', label: 'Subtotal', tableOptions: { align: 'right' } },
    fulfilled: {
        key: 'quantity_delivered',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'Entregado',
        tableOptions: { align: 'right' },
        render: (l) => (
            <Fulfilment done={num(l.quantity_delivered ?? l.quantity_received ?? l.delivered_quantity ?? l.received_quantity)} total={num(l.quantity)} />
        ),
    },
    invoiced: {
        key: 'quantity_invoiced',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'Facturado',
        tableOptions: { align: 'right' },
        render: (l) => <Fulfilment done={num(l.quantity_invoiced)} total={num(l.quantity)} />,
    },
    work_order: {
        key: 'work_order_summary',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'OT',
        render: (l) => l.work_order_summary
            ? <DataCell.Entity entityLabel="production.workorder" data={l.work_order_summary} size="sm" />
            : null,
    },
})
