import { createEntityFields, DataCell } from '@/components/shared'
import type { CreditLedgerEntry } from './api/creditsApi'

export const agingLabel: Record<string, string> = {
    current: "Al día",
    overdue_30: "1-30 días",
    overdue_60: "31-60 días",
    overdue_90: "61-90 días",
    overdue_90plus: "+90 días",
}

export const creditLedgerEntryFields = createEntityFields<CreditLedgerEntry>()({
    document: {
        key: 'number',
        type: 'computed',
        label: 'N° Documento',
        placement: 'detail',
        render: (h) => (
            <DataCell.Entity entityLabel="sales.saleorder" data={h as unknown as Record<string, unknown>} />
        ),
    },
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
        placement: 'detail',
    },
    dueDate: {
        key: 'due_date',
        type: 'computed',
        label: 'Vencimiento',
        placement: 'detail',
        render: (h) => (
            <div className="flex items-center gap-1.5 w-full">
                <DataCell.Date value={h.due_date} />
                {h.days_overdue > 0 && (
                    <span className="text-destructive font-bold text-2xs">({h.days_overdue}d)</span>
                )}
            </div>
        ),
    },
    total: {
        key: 'effective_total',
        type: 'currency',
        label: 'Total',
        placement: 'detail',
        tableOptions: { align: 'right' },
    },
    paid: {
        key: 'paid_amount',
        type: 'currencyFlow',
        label: 'Pagado',
        placement: 'detail',
        direction: "inflow",
    },
    balance: {
        key: 'balance',
        type: 'currency',
        label: 'Saldo',
        placement: 'detail',
        className: 'font-bold',
        tableOptions: { align: 'right' },
    },
    origin: {
        key: 'credit_assignment_origin',
        type: 'chip',
        label: 'Origen',
        placement: 'detail',
        get: (h) => h.credit_assignment_origin_display || "—",
        intent: (h) => h.credit_assignment_origin === "MANUAL" ? "neutral" : h.credit_assignment_origin === "SALE" ? "info" : "warning",
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
        placement: 'detail',
        get: (r) => r.aging_bucket === 'current' ? 'SUCCESS' : (r.days_overdue > 60 ? 'ERROR' : 'WARNING'),
        getLabel: (r) => agingLabel[r.aging_bucket],
    },
})
