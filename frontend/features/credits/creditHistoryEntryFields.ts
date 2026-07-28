import { createEntityFields } from '@/components/shared'
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
        type: 'text',
        label: 'Cliente',
        tableOptions: { align: 'center' },
    },
    saleOrderNumber: {
        key: 'number',
        type: 'code',
        label: 'Nota Venta',
        tableOptions: { align: 'center' },
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
