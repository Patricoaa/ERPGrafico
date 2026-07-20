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
        type: 'computed',
        label: 'Folio',
        tableOptions: { width: 100 },
        render: (m) => (
            <div className="flex flex-col items-center gap-0.5">
                <DataCell.Code>{m.display_id ?? String(m.id)}</DataCell.Code>
                <DataCell.Date value={m.date} />
            </div>
        ),
    },
    productName: {
        key: 'product_name',
        type: 'computed',
        label: 'Producto',
        render: (m) => (
            <div className="flex flex-col items-center py-1 w-full">
                <DataCell.Text>{m.product_name}</DataCell.Text>
                <div className="flex gap-2 items-center justify-center">
                    {m.product_internal_code && (
                        <DataCell.Code>{m.product_internal_code}</DataCell.Code>
                    )}
                    {m.product_code && m.product_code !== m.product_internal_code && (
                        <DataCell.Code>{m.product_code}</DataCell.Code>
                    )}
                </div>
            </div>
        ),
    },
    flow: {
        key: 'source_location_name',
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
        surfaces: ['card'],
    },
    sourceLocation: {
        key: 'source_location_name',
        type: 'text',
        label: 'Origen',
        surfaces: ['card'],
    },
    destinationLocation: {
        key: 'destination_location_name',
        type: 'text',
        label: 'Destino',
        surfaces: ['card'],
    },
    quantity: {
        key: 'quantity',
        type: 'numericFlow',
        label: 'Cantidad',
        get: (m) => ({ value: Number(m.quantity), unit: m.uom_name, showSign: true }),
        surfaces: ['card'],
    },
}, {
    title: { field: 'product_name' },
})
