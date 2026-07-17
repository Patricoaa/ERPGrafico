import { createEntityFields } from '@/components/shared'
import type { UnbilledItemRow } from '../types'

export const unbilledChargeFields = createEntityFields<UnbilledItemRow>()({
    chargeType: {
        key: 'chargeType',
        type: 'status',
        label: 'Tipo',
        get: (i) => i.chargeType || i.source,
        getLabel: (i) => i.chargeTypeDisplay || i.source,
    },
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
    },
    notes: {
        key: 'notes',
        type: 'text',
        label: 'Descripción',
    },
    amount: {
        key: 'amount',
        type: 'currency',
        label: 'Monto',
        cellProps: { weight: 'bold' },
        cardPlacement: 'footer',
    },
})
