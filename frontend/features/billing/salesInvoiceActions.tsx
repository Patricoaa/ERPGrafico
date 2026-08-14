import { createEntityActions } from '@/components/shared'
import type { Invoice } from './types'

export interface SalesInvoiceActionsCtx {
    onHub: (doc: Invoice) => void
}

export const salesInvoiceActions = createEntityActions<Invoice, SalesInvoiceActionsCtx>((doc, ctx) => {
    return [
        { action: "hub", onClick: () => ctx.onHub(doc) },
    ]
})
