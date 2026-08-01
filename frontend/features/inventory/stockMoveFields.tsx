import { createEntityFields } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { formatEntityDisplay } from '@/lib/entity-registry'
import { ArrowRightLeft } from 'lucide-react'

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
        type: 'computed',
        label: 'Origen → Destino',
        render: (m) => (
            <div className="flex flex-col items-center gap-0.5 text-center">
                <DataCell.Text>{m.source_location_name}</DataCell.Text>
                <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                <DataCell.Text>{m.destination_location_name}</DataCell.Text>
            </div>
        ),
    },
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
    },
    quantity: {
        key: 'quantity',
        type: 'computed',
        label: 'Cantidad',
        fieldRole: 'flow',
        render: (m) => (
            <DataCell.NumericFlow
                value={Math.abs(Number(m.quantity))}
                uom={m.uom_abbreviation || m.uom_name}
                direction={m.direction === 'IN' ? 'inflow' : m.direction === 'OUT' ? 'outflow' : 'neutral'}
            />
        ),
    },
})
