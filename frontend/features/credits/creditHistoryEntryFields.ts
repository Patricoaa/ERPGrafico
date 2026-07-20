import { createEntityFields } from '@/components/shared'
import type { CreditHistoryEntry } from './api/creditsApi'

export const creditHistoryEntryFields = createEntityFields<CreditHistoryEntry>()({
    date: {
        order: 10,
        key: 'date',
        type: 'date',
        label: 'Fecha',
        tableOptions: { align: 'center' },
    },
    customerName: {
        order: 20,
        key: 'customer_name',
        type: 'text',
        label: 'Cliente',
        tableOptions: { align: 'center' },
    },
    saleOrderNumber: {
        order: 30,
        key: 'number',
        type: 'code',
        label: 'Nota Venta',
        tableOptions: { align: 'center' },
    },
    effectiveTotal: {
        order: 40,
        key: 'effective_total',
        type: 'currency',
        label: 'Monto',
        tableOptions: { align: 'center' },
    },
    creditAssignmentOrigin: {
        order: 50,
        key: 'credit_assignment_origin',
        type: 'status',
        label: 'Origen',
        tableOptions: { align: 'center' },
        get: (h) => `ORIGIN_${h.credit_assignment_origin}`,
        getLabel: (h) => h.credit_assignment_origin_display,
    },
})
