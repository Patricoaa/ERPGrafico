import { createEntityFields, DataCell } from '@/components/shared'
import type { CreditHistoryEntry } from './api/creditsApi'

export const creditHistoryEntryFields = createEntityFields<CreditHistoryEntry>()({
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
        tableOptions: { align: 'center' },
    },
    customerName: {
        key: 'customer_name',
        type: 'computed',
        label: 'Cliente',
        tableOptions: { align: 'center' },
        render: (h) => (
            <DataCell.ContactLink contactId={h.customer_id}>
                {h.customer_name}
            </DataCell.ContactLink>
        ),
    },
    saleOrderNumber: {
        key: 'number',
        type: 'computed',
        label: 'Nota Venta',
        tableOptions: { align: 'center' },
        render: (h) => (
            <DataCell.Entity entityLabel="sales.saleorder" data={h as unknown as Record<string, unknown>} size="sm" />
        ),
    },
    effectiveTotal: {
        key: 'effective_total',
        type: 'currency',
        label: 'Monto',
        tableOptions: { align: 'center' },
    },
    creditAssignmentOrigin: {
        key: 'credit_assignment_origin',
        type: 'status',
        label: 'Origen',
        tableOptions: { align: 'center' },
        get: (h) => `ORIGIN_${h.credit_assignment_origin}`,
        getLabel: (h) => h.credit_assignment_origin_display,
    },
})
