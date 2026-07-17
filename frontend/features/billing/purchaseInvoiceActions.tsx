import { createEntityActions } from '@/components/shared'
import { FileEdit, FileBadge } from 'lucide-react'
import type { Invoice } from './types'

export interface PurchaseInvoiceActionsCtx {
    onDetail: (doc: Invoice) => void
    onPay: (doc: Invoice) => void
    onHub: (doc: Invoice) => void
    onReceive: (doc: Invoice) => void
    onCompleteFolio: (doc: Invoice) => void
    onCreateNote: (doc: Invoice) => void
    onPaymentHistory: (doc: Invoice) => void
    onDelete: (id: number) => void
    onAnnul: (id: number) => void
}

export const purchaseInvoiceActions = createEntityActions<Invoice, PurchaseInvoiceActionsCtx>((doc, ctx) => {
    const isNote = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(doc.dte_type)
    const canPay = (doc.pending_amount ?? 0) > 0 && doc.status === 'POSTED'
    const canReceive = !!(doc.purchase_order || isNote) && doc.po_receiving_status !== 'RECEIVED'
    const canCompleteFolio = doc.status === 'DRAFT'
    const canCreateNote = !isNote && !!doc.number && doc.status !== 'DRAFT'
    const hasPayments = (doc.related_documents?.payments?.length ?? 0) > 0 || (doc.serialized_payments?.length ?? 0) > 0
    const canDelete = doc.status === 'DRAFT'
    const canAnnul = doc.status !== 'DRAFT' && doc.status !== 'CANCELLED'

    if (doc.purchase_order) {
        return [
            { action: "hub", onClick: () => ctx.onHub(doc) },
        ]
    }

    return [
        { action: "detail", onClick: () => ctx.onDetail(doc) },
        { action: "pay", onClick: () => ctx.onPay(doc), visible: canPay },
        { action: "receive", label: isNote ? "Devolución Mercadería" : "Recibir Mercadería", onClick: () => ctx.onReceive(doc), visible: canReceive },
        { action: "edit", icon: FileEdit, label: "Completar Folio", onClick: () => ctx.onCompleteFolio(doc), visible: canCompleteFolio },
        { action: "detail", icon: FileBadge, label: "Registrar Nota Crédito/Débito", onClick: () => ctx.onCreateNote(doc), visible: canCreateNote },
        { action: "history", label: "Historial de Pagos", onClick: () => ctx.onPaymentHistory(doc), visible: hasPayments },
        { separator: true },
        { action: "delete", onClick: () => ctx.onDelete(doc.id), visible: canDelete },
        { action: "annul", onClick: () => ctx.onAnnul(doc.id), visible: canAnnul },
    ]
})
