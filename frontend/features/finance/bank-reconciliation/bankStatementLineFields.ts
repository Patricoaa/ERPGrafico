import { createEntityFields } from '@/components/shared'
import type { BankStatementLine } from './types'

export const bankStatementLineFields = createEntityFields<BankStatementLine>()({
    transactionDate: {
        order: 10,
        key: 'transaction_date',
        type: 'date',
        label: 'Fecha',
    },
    description: {
        order: 20,
        key: 'description',
        type: 'text',
        label: 'Descripción',
    },
    type: {
        order: 30,
        key: 'type',
        type: 'computed',
        label: 'Tipo',
    },
    amount: {
        order: 40,
        key: 'amount',
        type: 'computed',
        label: 'Monto',
        tableOptions: { align: 'right' }
    },
    debit: {
        order: 50,
        key: 'debit',
        type: 'currency',
        label: 'Cargo',
        showZeroAsDash: true,
        tableOptions: { align: 'right' }
    },
    credit: {
        order: 60,
        key: 'credit',
        type: 'currency',
        label: 'Abono',
        showZeroAsDash: true,
        tableOptions: { align: 'right' }
    },
    balance: {
        order: 70,
        key: 'balance',
        type: 'currency',
        label: 'Saldo',
        tableOptions: { align: 'right' }
    },
    status: {
        order: 80,
        key: 'reconciliation_state',
        type: 'status',
        label: 'Estado',
        getLabel: (h) => h.reconciliation_state === 'MATCHED' ? "Sugerencia Match" : h.reconciliation_state_display
    }
})
