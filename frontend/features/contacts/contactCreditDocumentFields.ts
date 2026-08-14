import { createEntityFields } from '@/components/shared'

/**
 * Represents a pending credit document shown in the ContactDrawer credit tab.
 * Compatible with PendingDebt from features/contacts/hooks/useContacts.
 */
export interface ContactCreditDocument {
    id: number
    date?: string
    number?: string
    display_id?: string
    balance: number | string
    [key: string]: unknown
}

export const contactCreditDocumentFields = createEntityFields<ContactCreditDocument>()({
    date: {
        key: 'date',
        type: 'date',
        label: 'Fecha',
    },
    number: {
        key: 'number',
        type: 'code',
        label: 'Número',
    },
    balance: {
        key: 'balance',
        type: 'currency',
        label: 'Saldo',
    },
})
