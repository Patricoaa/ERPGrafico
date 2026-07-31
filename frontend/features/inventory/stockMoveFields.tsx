import { createEntityFields } from '@/components/shared'
import { DataCell } from '@/components/shared'
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
    description: string
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
        get: (m) => m.display_id ?? String(m.id),
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
                <DataCell.Secondary>{m.source_location_name}</DataCell.Secondary>
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
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
            <DataCell.NumericFlow value={Number(m.quantity)} unit={m.uom_name} />
        ),
    },
})
