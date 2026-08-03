import { createEntityFields } from '@/components/shared'
import type { CreditCardStatement } from './types'

export const cardStatementFields = createEntityFields<CreditCardStatement>()({
    displayId: {
        key: 'display_id',
        type: 'code',
        label: 'Folio',
    },
    cardAccountName: {
        key: 'card_account_name',
        type: 'text',
        label: 'Tarjeta',
    },
    period: {
        key: 'period_month',
        type: 'text',
        label: 'Período',
        get: (s) => `${String(s.period_month).padStart(2, '0')}/${s.period_year}`,
    },
    billedAmount: {
        key: 'billed_amount',
        type: 'currency',
        label: 'Facturado',
        get: (s) => parseFloat(s.billed_amount),
        tableOptions: { align: 'right' },
    },
    cutOffDate: {
        key: 'cut_off_date',
        type: 'date',
        label: 'Cierre',
    },
    dueDate: {
        key: 'due_date',
        type: 'text',
        label: 'Vencimiento',
        get: (s) => s.due_date
            ? new Date(s.due_date + 'T00:00:00').toLocaleDateString('es-CL')
            : '—',
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
    },
    paidAt: {
        key: 'paid_at',
        type: 'dateTime',
        label: 'Pagado el',
    },
    paymentAccountName: {
        key: 'payment_account_name',
        type: 'text',
        label: 'Cuenta de pago',
    },
    notes: {
        key: 'notes',
        type: 'text',
        label: 'Notas',
    },
})
