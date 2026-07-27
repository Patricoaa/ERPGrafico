import { createEntityFields } from '@/components/shared'
import type { BankLoan } from './types'
import { MoneyDisplay } from '@/components/shared'

export const loanFields = createEntityFields<BankLoan>()({
    displayId: {
        key: 'display_id',
        type: 'code',
        label: 'ID Interno',
        order: 10,
    },
    lenderName: {
        key: 'lender_name',
        type: 'text',
        label: 'Banco',
        order: 20,
    },
    currency: {
        key: 'currency',
        type: 'text',
        label: 'Moneda',
        order: 25,
    },
    principal: {
        key: 'principal',
        type: 'computed',
        label: 'Capital',
        order: 30,
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
        order: 40,
        tableOptions: { align: 'right' },
        get: (l) => `${parseFloat(l.interest_rate).toFixed(2)}% ${l.rate_basis_display?.toLowerCase() || ''}`,
    },
    outstandingBalance: {
        key: 'outstanding_balance',
        type: 'computed',
        label: 'Saldo Insoluto',
        order: 50,
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
        order: 60,
        tableOptions: { align: 'right' },
        get: (l) => `${l.term_months} meses`,
    },
    nextDueDate: {
        key: 'next_due_date',
        type: 'text',
        label: 'Próx. Vto.',
        order: 70,
        get: (l) => l.next_due_date
            ? new Date(l.next_due_date + 'T00:00:00').toLocaleDateString('es-CL')
            : '—',
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
        order: 80,
    },
})
