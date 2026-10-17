import { createEntityFields, DataCell } from '@/components/shared'
import { DocumentRefLink } from '@/features/documents'
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
        render: (h) => <DocumentRefLink documentRef={h.document} />,
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
