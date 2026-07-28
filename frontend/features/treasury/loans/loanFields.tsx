import { createEntityFields } from '@/components/shared'
import type { BankLoan } from './types'
import { MoneyDisplay } from '@/components/shared'

export const loanFields = createEntityFields<BankLoan>()({
    displayId: {
        key: 'display_id',
        type: 'code',
        label: 'ID Interno',
    },
    lenderName: {
        key: 'lender_name',
        type: 'text',
        label: 'Banco',
    },
    currency: {
        key: 'currency',
        type: 'text',
        label: 'Moneda',
    },
    principal: {
        key: 'principal',
        type: 'computed',
        label: 'Capital',
        render: (l) => (
            <div className="flex justify-end">
                <MoneyDisplay amount={parseFloat(l.principal)} />
            </div>
        ),
    },
    interestRate: {
        key: 'interest_rate',
        type: 'text',
        label: 'Tasa',
        tableOptions: { align: 'right' },
        get: (l) => `${parseFloat(l.interest_rate).toFixed(2)}% ${l.rate_basis_display?.toLowerCase() || ''}`,
    },
    outstandingBalance: {
        key: 'outstanding_balance',
        type: 'computed',
        label: 'Saldo Insoluto',
        render: (l) => (
            <div className="flex justify-end">
                <MoneyDisplay
                    amount={parseFloat(l.outstanding_balance)}
                    className={l.status === 'ACTIVE' ? 'font-bold' : 'text-muted-foreground'}
                />
            </div>
        ),
    },
    termMonths: {
        key: 'term_months',
        type: 'text',
        label: 'Plazo',
        tableOptions: { align: 'right' },
        get: (l) => `${l.term_months} meses`,
    },
    nextDueDate: {
        key: 'next_due_date',
        type: 'text',
        label: 'Próx. Vto.',
        get: (l) => l.next_due_date
            ? new Date(l.next_due_date + 'T00:00:00').toLocaleDateString('es-CL')
            : '—',
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
    },
})
