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
    cuota: {
        key: 'installmentNumber',
        type: 'computed',
        label: 'Cuota',
        render: (i) => {
            if (i.source === 'pending') {
                return (
                    <div className="flex justify-end w-full">
                        <span className="text-xs text-muted-foreground">N/A</span>
                    </div>
                )
            }
            if (!i.installmentNumber || !i.totalInstallments) return null
            return (
                <div className="flex justify-end w-full">
                    <span className="text-xs font-medium">
                        {i.installmentNumber}/{i.totalInstallments}
                    </span>
                </div>
            )
        },
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
        weight: 'bold',
    },
}, { title: { field: 'reference' } })
