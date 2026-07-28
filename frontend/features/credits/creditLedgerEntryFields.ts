import { createEntityFields } from '@/components/shared'
import type { CreditLedgerEntry } from './api/creditsApi'
export const creditLedgerEntryFields = createEntityFields<CreditLedgerEntry>()({
    document: {
        key: 'document',
        type: 'computed',
        label: 'N° Documento',
    },
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
    },
    dueDate: {
        key: 'due_date',
        type: 'date',
        label: 'Vencimiento',
    },
    total: {
        key: 'effective_total',
        type: 'currency',
        label: 'Total',
        tableOptions: { align: 'right' },
    },
    paid: {
        key: 'paid_amount',
        type: 'currency',
        label: 'Pagado',
        tableOptions: { align: 'right' },
    },
    balance: {
        key: 'balance',
        type: 'currency',
        label: 'Saldo',
        tableOptions: { align: 'right' },
    },
    origin: {
        key: 'credit_assignment_origin',
        type: 'status',
        label: 'Origen',
        get: (h) => h.credit_assignment_origin_display ? (h.credit_assignment_origin === "MANUAL" ? "neutral" : h.credit_assignment_origin === "SALE" ? "info" : "warning") : "", // it's using Chip, we can use status and map to chip later
        getLabel: (h) => h.credit_assignment_origin_display || "—",
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
        get: (r) => r.aging_bucket === 'current' ? 'SUCCESS' : (r.days_overdue > 60 ? 'ERROR' : 'WARNING'),
    }
})
