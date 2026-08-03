import { createEntityFields } from '@/components/shared'
import type { ReconciliationSystemItem } from './types'

export const reconciliationSystemItemFields = createEntityFields<ReconciliationSystemItem>()({
    date: {
        key: 'date',
        type: 'date',
        label: 'Documento',
    },
    contactName: {
        key: 'contact_name',
        type: 'text',
        label: 'Entidad / Concepto',
    },
    type: {
        key: 'movement_type',
        type: 'text',
        label: 'Tipo',
    },
    amount: {
        key: 'amount',
        type: 'currency',
        label: 'Monto',
        tableOptions: { align: 'right' }
    }
})
