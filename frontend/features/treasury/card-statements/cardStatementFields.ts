import { createEntityFields } from '@/components/shared'
import type { CreditCardStatement } from './types'

export const cardStatementFields = createEntityFields<CreditCardStatement>()({
    period: {
        key: 'period_month',
        type: 'text',
        label: 'Período',
        cardPlacement: 'body',
        get: (s) => `${String(s.period_month).padStart(2, '0')}/${s.period_year}`,
    },
    billedAmount: {
        key: 'billed_amount',
        type: 'currency',
        label: 'Facturado',
        cardPlacement: 'body',
        get: (s) => parseFloat(s.billed_amount) || 0,
    },
    dueDate: {
        key: 'due_date',
        type: 'text',
        label: 'Vencimiento',
        cardPlacement: 'body',
        get: (s) => s.due_date
            ? new Date(s.due_date + 'T00:00:00').toLocaleDateString('es-CL')
            : '—',
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
    },
})
