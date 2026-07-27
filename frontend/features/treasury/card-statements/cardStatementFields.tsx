import { createEntityFields } from '@/components/shared'
import type { CreditCardStatement } from './types'
import { DataCell, MoneyDisplay } from '@/components/shared'

export const cardStatementFields = createEntityFields<CreditCardStatement>()({
    displayId: {
        key: 'display_id',
        type: 'computed',
        label: 'Folio',
        order: 10,
        render: (s) => (
            <div className="flex flex-col items-center">
                <DataCell.Code>{s.display_id}</DataCell.Code>
                <DataCell.Secondary>{s.card_account_name}</DataCell.Secondary>
            </div>
        ),
    },
    period: {
        key: 'period_month',
        type: 'text',
        label: 'Período',
        order: 20,
        get: (s) => `${String(s.period_month).padStart(2, '0')}/${s.period_year}`,
    },
    billedAmount: {
        key: 'billed_amount',
        type: 'computed',
        label: 'Facturado',
        order: 30,
        render: (s) => (
            <div className="flex justify-end">
                <MoneyDisplay amount={parseFloat(s.billed_amount)} />
            </div>
        ),
    },
    dueDate: {
        key: 'due_date',
        type: 'text',
        label: 'Vencimiento',
        order: 40,
        get: (s) => s.due_date
            ? new Date(s.due_date + 'T00:00:00').toLocaleDateString('es-CL')
            : '—',
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
        order: 50,
    },
})
