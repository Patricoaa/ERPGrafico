import { createEntityFields } from '@/components/shared'

interface LoanScheduleRow {
    number: number
    due_date: string
    principal_amount: string
    interest_amount: string
    insurance_amount: string
    total_amount: string
    outstanding_balance: string
}

export const loanRegisterFields = createEntityFields<LoanScheduleRow>()({
    number: { key: 'number', type: 'text', label: '#', tableOptions: { align: 'center' } },
    due_date: { key: 'due_date', type: 'date', label: 'Vencimiento' },
    principal_amount: {
        key: 'principal_amount',
        type: 'currency',
        label: 'Capital',
        get: (r) => r.principal_amount,
        tableOptions: { align: 'right' },
    },
    interest_amount: {
        key: 'interest_amount',
        type: 'currency',
        label: 'Interés',
        get: (r) => r.interest_amount,
        tableOptions: { align: 'right' },
    },
    insurance_amount: {
        key: 'insurance_amount',
        type: 'currency',
        label: 'Seguro',
        get: (r) => r.insurance_amount,
        tableOptions: { align: 'right' },
    },
    total_amount: {
        key: 'total_amount',
        type: 'currency',
        label: 'Total',
        get: (r) => r.total_amount,
        tableOptions: { align: 'right' },
    },
    outstanding_balance: {
        key: 'outstanding_balance',
        type: 'currency',
        label: 'Saldo',
        get: (r) => r.outstanding_balance,
        tableOptions: { align: 'right' },
    },
})
