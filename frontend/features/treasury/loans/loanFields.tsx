import { createEntityFields } from '@/components/shared'
import type { BankLoan } from './types'
import { cn } from '@/lib/utils'

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
        type: 'currency',
        label: 'Capital',
        get: (l) => parseFloat(l.principal),
        tableOptions: { align: 'right' },
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
        type: 'currency',
        label: 'Saldo Insoluto',
        get: (l) => parseFloat(l.outstanding_balance),
        cellProps: { weight: 'bold' },
        className: (_v, l) => cn(l.status === 'ACTIVE' && 'text-muted-foreground'),
        tableOptions: { align: 'right' },
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
