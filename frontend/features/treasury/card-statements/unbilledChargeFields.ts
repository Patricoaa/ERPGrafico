import { createEntityFields } from '@/components/shared'
import type { UnbilledItemRow } from '../types'

export const unbilledChargeFields = createEntityFields<UnbilledItemRow>()({
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
    },
    amount: {
        key: 'amount',
        type: 'currency',
        label: 'Monto',
        cellProps: { weight: 'bold' },
    },
})
