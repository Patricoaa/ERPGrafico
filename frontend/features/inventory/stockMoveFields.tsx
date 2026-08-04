import { createEntityFields } from '@/components/shared'
import { formatEntityDisplay } from '@/lib/entity-registry'

export interface StockMove {
    id: number
    display_id?: string
    date: string
    product_name: string
    product_internal_code?: string
    product_code?: string
    source_location: number
    source_location_name: string
    destination_location: number
    destination_location_name: string
    quantity: string
    uom_name: string
    uom_abbreviation?: string
    description: string
    direction?: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'OTHER'
    related_documents: Array<{
        type: string
        id: number | string
        name: string
    }>
}

export const stockMoveFields = createEntityFields<StockMove>()({
    folio: {
        key: 'display_id',
        type: 'code',
        label: 'Folio',
        tableOptions: { width: 100 },
        get: (m) => formatEntityDisplay('inventory.stockmove', m as unknown as Record<string, unknown>),
    },
    productName: {
        key: 'product_name',
        type: 'text',
        label: 'Producto',
    },
    flow: {
        key: 'flow_display',
        type: 'sourceDest',
        label: 'Origen → Destino',
        get: (m) => ({
            source: m.source_location_name,
            dest: m.destination_location_name,
        }),
    },
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
    },
    quantity: {
        key: 'quantity',
        type: 'numericFlow',
        label: 'Cantidad',
        get: (m) => Math.abs(Number(m.quantity)),
        direction: (m) => m.direction === 'IN' ? 'inflow' : m.direction === 'OUT' ? 'outflow' : 'neutral',
        unit: (m) => m.uom_abbreviation || m.uom_name,
    },
})
