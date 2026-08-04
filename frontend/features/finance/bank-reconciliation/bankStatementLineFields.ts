import { createEntityFields } from '@/components/shared'
import type { BankStatementLine } from './types'

export const bankStatementLineFields = createEntityFields<BankStatementLine>()({
    transactionDate: {
        key: 'transaction_date',
        type: 'date',
        label: 'Fecha',
    },
    description: {
        key: 'description',
        type: 'text',
        label: 'Descripción',
    },
    type: {
        key: 'type',
        type: 'text',
        label: 'Tipo',
    },
    amount: {
        key: 'amount',
        type: 'currency',
        label: 'Monto',
        tableOptions: { align: 'right' }
    },
    debit: {
        key: 'debit',
        type: 'currency',
        label: 'Cargo',
        showZeroAsDash: true,
        tableOptions: { align: 'right' }
    },
    credit: {
        key: 'credit',
        type: 'currency',
        label: 'Abono',
        showZeroAsDash: true,
        tableOptions: { align: 'right' }
    },
    balance: {
        key: 'balance',
        type: 'currency',
        label: 'Saldo',
        tableOptions: { align: 'right' }
    },
    status: {
        key: 'reconciliation_state',
        type: 'status',
        label: 'Estado',
        getLabel: (h) => h.reconciliation_state === 'MATCHED' ? "Sugerencia Match" : h.reconciliation_state_display
    }
})
