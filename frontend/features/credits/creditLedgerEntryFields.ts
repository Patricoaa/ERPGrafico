import { createEntityFields } from '@/components/shared'
import type { CreditLedgerEntry } from './api/creditsApi'
export const creditLedgerEntryFields = createEntityFields<CreditLedgerEntry>()({
    document: {
        order: 10,
        key: 'document',
        type: 'computed',
        label: 'N° Documento',
    },
    date: {
        order: 20,
        key: 'date',
        type: 'date',
        label: 'Fecha',
    },
    dueDate: {
        order: 30,
        key: 'due_date',
        type: 'date',
        label: 'Vencimiento',
    },
    total: {
        order: 40,
        key: 'effective_total',
        type: 'currency',
        label: 'Total',
        tableOptions: { align: 'right' },
    },
    paid: {
        order: 50,
        key: 'paid_amount',
        type: 'currency',
        label: 'Pagado',
        tableOptions: { align: 'right' },
    },
    balance: {
        order: 60,
        key: 'balance',
        type: 'currency',
        label: 'Saldo',
        tableOptions: { align: 'right' },
    },
    origin: {
        order: 70,
        key: 'credit_assignment_origin',
        type: 'status',
        label: 'Origen',
        get: (h) => h.credit_assignment_origin_display ? (h.credit_assignment_origin === "MANUAL" ? "neutral" : h.credit_assignment_origin === "SALE" ? "info" : "warning") : "", // it's using Chip, we can use status and map to chip later
        getLabel: (h) => h.credit_assignment_origin_display || "—",
    },
    status: {
        order: 80,
        key: 'status',
        type: 'status',
        label: 'Estado',
        get: (r) => r.aging_bucket === 'current' ? 'SUCCESS' : (r.days_overdue > 60 ? 'ERROR' : 'WARNING'),
    }
})
