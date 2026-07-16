import { createEntityFields } from '@/components/shared'

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
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
        cardPlacement: 'body',
    },
    sourceLocation: {
        key: 'source_location_name',
        type: 'text',
        label: 'Origen',
        cardPlacement: 'body',
    },
    destinationLocation: {
        key: 'destination_location_name',
        type: 'text',
        label: 'Destino',
        cardPlacement: 'body',
    },
    quantity: {
        key: 'quantity',
        type: 'numericFlow',
        label: 'Cantidad',
        cardPlacement: 'body',
        get: (m) => ({ value: Number(m.quantity), unit: m.uom_name, showSign: true }),
    },
})
