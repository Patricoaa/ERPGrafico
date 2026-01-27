import type { ActionRegistry } from '@/types/actions'
import {
    FileText,
    Package,
    Banknote,
    History,
    FileBadge,
    X,
    Ban,
    Eye,
    FileEdit,
    Trash2,
    Hash,
    RotateCcw,
    PackageMinus,
    DollarSign,
    MinusCircle,
    PlusCircle
} from 'lucide-react'

/**
 * Purchase Order Action Registry
 * Defines all available actions for purchase orders with permission requirements
 */
export const purchaseOrderActions: ActionRegistry = {
    documents: {
        id: 'documents',
        label: 'Documentos',
        icon: FileText,
        actions: [
            {
                id: 'complete-folio',
                label: 'Registrar Folio',
                icon: FileEdit,
                requiredPermissions: ['billing.change_invoice'],
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type
                    if (isInvoiced) {
                        return activeDoc.status === 'DRAFT' || activeDoc.number === 'Draft' || !activeDoc.number
                    }
                    const invoices = activeDoc.related_documents?.invoices || activeDoc.invoices || []
                    return invoices.some((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft')
                },
                badge: { type: 'warning', label: 'Pendiente' },
                excludedStatus: ['CANCELLED']
            },
            {
                id: 'view-documents',
                label: 'Ver Documentos',
                icon: Eye,
                requiredPermissions: ['billing.view_invoice'],
                checkAvailability: (order) => (order.related_documents?.invoices?.length || 0) > 0
            }
        ]
    },

    receptions: {
        id: 'receptions',
        label: 'Recepciones',
        icon: Package,
        actions: [
            {
                id: 'register-reception',
                label: 'Registrar Recepción',
                icon: Package,
                requiredPermissions: ['inventory.add_stockmove'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // [FIX] For Debit Note: Check if items are fully received based on Note lines
                        if (activeDoc.dte_type === 'NOTA_DEBITO') {
                            const lines = activeDoc.lines || []
                            const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
                            // quantity_received is populated by InvoiceSerializer based on linked receipts
                            const totalReceived = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity_received || 0) || 0), 0)
                            return totalReceived < totalOrdered
                        }

                        // For generic invoices on order, fallback (though usually redundant in Note Hub)
                        return activeDoc.po_receiving_status !== 'RECEIVED'
                    }

                    // Default logic for Purchase Order
                    return activeDoc.receiving_status !== 'RECEIVED'
                },
                badge: { type: 'pending' }
            },
            {
                id: 'confirm-service-delivery',
                label: 'Confirmar Entrega de Servicio',
                icon: FileBadge,
                requiredPermissions: ['inventory.add_stockmove'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (order) => {
                    // Show if not fully received and has service products
                    const lines = order.lines || order.items || []
                    const hasServices = lines.some((l: any) => l.product_type === 'SERVICE' && (parseFloat(l.quantity_pending) || 0) > 0)
                    return order.receiving_status !== 'RECEIVED' && hasServices
                },
                badge: { type: 'pending' }
            },
            {
                id: 'register-merchandise-return',
                label: 'Devolver Mercadería',
                icon: PackageMinus,
                requiredPermissions: ['inventory.add_stockmove'],
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // For Purchase Credit Note, we want to register a merchandise return to supplier
                        if (activeDoc.dte_type === 'NOTA_CREDITO') {
                            const lines = activeDoc.lines || []
                            const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
                            const totalDelivered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity_received || 0) || 0), 0)
                            return totalDelivered < totalOrdered
                        }
                        return false
                    }

                    // Only if invoice is DRAFT
                    const hasDraftInvoice = activeDoc.related_documents?.invoices?.some(
                        (inv: any) => inv.status === 'DRAFT'
                    )

                    // Only if has received stockable products
                    const lines = activeDoc.lines || activeDoc.items || []
                    const hasStockableReceived = lines.some((line: any) =>
                        (line.quantity_received || 0) > 0 && line.product?.track_inventory
                    )

                    return hasDraftInvoice && hasStockableReceived
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            },
            {
                id: 'view-receptions',
                label: 'Ver Recepciones',
                icon: Eye,
                requiredPermissions: ['inventory.view_stockmove'],
                checkAvailability: (order) => {
                    return (order.related_documents?.receipts?.length || 0) > 0
                }
            }
        ]
    },

    payments: {
        id: 'payments',
        label: 'Pagos',
        icon: Banknote,
        actions: [
            {
                id: 'register-payment',
                label: 'Registrar Pago',
                icon: Banknote,
                requiredPermissions: ['treasury.add_payment'],
                // Removed specific requiredStatus to rely on financial state
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // Allow registration for any posted document with pending balance
                        const hasPendingAmount = (parseFloat(activeDoc.pending_amount) ?? 0) > 0
                        return hasPendingAmount && activeDoc.status !== 'CANCELLED' && activeDoc.status !== 'DRAFT' && activeDoc.dte_type !== 'NOTA_CREDITO'
                    }

                    // Show if there's a pending amount or order is not paid
                    const hasPendingAmount = (activeDoc.pending_amount ?? 0) > 0
                    return hasPendingAmount || (activeDoc.status !== 'PAID' && activeDoc.status !== 'CANCELLED')
                },
                badge: { type: 'pending' },
                excludedStatus: ['CANCELLED']
            },
            {
                id: 'register-payment-return',
                label: 'Devolver Pago',
                icon: DollarSign,
                requiredPermissions: ['treasury.add_payment'],
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // For Purchase Credit Note, we expect a refund FROM supplier
                        if (activeDoc.dte_type === 'NOTA_CREDITO') {
                            const hasPendingAmount = (parseFloat(activeDoc.pending_amount) ?? 0) > 0
                            return hasPendingAmount && activeDoc.status !== 'CANCELLED'
                        }
                        return false
                    }

                    // Only if invoice is DRAFT
                    const hasDraftInvoice = activeDoc.related_documents?.invoices?.some(
                        (inv: any) => inv.status === 'DRAFT'
                    )

                    // Only if has posted payments
                    const payments = activeDoc.related_documents?.payments || []
                    const hasPostedPayments = payments.some(
                        (pay: any) => pay.journal_entry?.state === 'POSTED'
                    )

                    return hasDraftInvoice && hasPostedPayments
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            },
            {
                id: 'payment-history',
                label: 'Historial de Pagos',
                icon: History,
                requiredPermissions: ['treasury.view_payment'],
                checkAvailability: (order) => {
                    const paymentsCount = order.related_documents?.payments?.length ||
                        order.serialized_payments?.length || 0
                    return paymentsCount > 0
                }
            },
        ]
    },

    notes: {
        id: 'notes',
        label: 'Notas de Crédito/Débito',
        icon: FileBadge,
        actions: [
            {
                id: 'create-credit-note',
                label: 'Crear Nota de Crédito',
                icon: MinusCircle,
                requiredPermissions: ['billing.add_invoice'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (order) => {
                    if (!order) return false
                    // Only show if there's a FACTURA or PURCHASE_INV (not BOLETA)
                    const hasFactura = order.related_documents?.invoices?.some((inv: any) =>
                        ['FACTURA', 'PURCHASE_INV'].includes(inv.dte_type)
                    )
                    // Don't show if there are any boletas (fiscal restriction)
                    const hasBoleta = order.related_documents?.invoices?.some((inv: any) =>
                        inv.dte_type === 'BOLETA'
                    )
                    return hasFactura && !hasBoleta
                },
                isDisabled: (order) => {
                    const hasIssuedFacturaWithFolio = order.related_documents?.invoices?.some((inv: any) =>
                        inv.status !== 'DRAFT' &&
                        ['FACTURA', 'PURCHASE_INV'].includes(inv.dte_type) &&
                        inv.number &&
                        inv.number !== 'Draft'
                    )
                    return !hasIssuedFacturaWithFolio
                },
                disabledTooltip: "Debe registrar el folio de la factura antes de crear una nota de crédito"
            },
            {
                id: 'create-debit-note',
                label: 'Crear Nota de Débito',
                icon: PlusCircle,
                requiredPermissions: ['billing.add_invoice'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (order) => {
                    if (!order) return false
                    // Only show if there's a FACTURA or PURCHASE_INV (not BOLETA)
                    const hasFactura = order.related_documents?.invoices?.some((inv: any) =>
                        ['FACTURA', 'PURCHASE_INV'].includes(inv.dte_type)
                    )
                    // Don't show if there are any boletas (fiscal restriction)
                    const hasBoleta = order.related_documents?.invoices?.some((inv: any) =>
                        inv.dte_type === 'BOLETA'
                    )
                    return hasFactura && !hasBoleta
                },
                isDisabled: (order) => {
                    const hasIssuedFacturaWithFolio = order.related_documents?.invoices?.some((inv: any) =>
                        inv.status !== 'DRAFT' &&
                        ['FACTURA', 'PURCHASE_INV'].includes(inv.dte_type) &&
                        inv.number &&
                        inv.number !== 'Draft'
                    )
                    return !hasIssuedFacturaWithFolio
                },
                disabledTooltip: "Debe registrar el folio de la factura antes de crear una nota de débito"
            }
        ]
    },

    returns: {
        id: 'returns',
        label: 'Devoluciones',
        icon: RotateCcw,
        actions: [
            {
                id: 'register-merchandise-return',
                label: 'Devolver Mercadería',
                icon: PackageMinus,
                requiredPermissions: ['inventory.add_stockmove'],
                checkAvailability: (order) => {
                    // Only if invoice is DRAFT
                    const hasDraftInvoice = order.related_documents?.invoices?.some(
                        (inv: any) => inv.status === 'DRAFT'
                    )

                    // Only if has received stockable products
                    const hasStockableReceived = order.lines?.some((line: any) =>
                        (line.quantity_received || 0) > 0 && line.product?.track_inventory
                    )

                    return hasDraftInvoice && hasStockableReceived
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            },
            {
                id: 'register-payment-return',
                label: 'Devolver Pago',
                icon: DollarSign,
                requiredPermissions: ['treasury.add_payment'],
                checkAvailability: (order) => {
                    // Only if invoice is DRAFT
                    const hasDraftInvoice = order.related_documents?.invoices?.some(
                        (inv: any) => inv.status === 'DRAFT'
                    )

                    // Only if has posted payments
                    const hasPostedPayments = order.related_documents?.payments?.some(
                        (pay: any) => pay.journal_entry?.state === 'POSTED'
                    )

                    return hasDraftInvoice && hasPostedPayments
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            }
        ]
    },

    management: {
        id: 'management',
        label: 'Gestión',
        icon: X,
        actions: [
            {
                id: 'annul-document',
                label: 'Anular Documento',
                icon: Ban,
                requiredPermissions: ['billing.delete_invoice'],
                checkAvailability: (order) => {
                    // Only show if there's a posted invoice WITHOUT folio (Draft)
                    // Backend will block annulment if folio exists (fiscal requirement)
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    return invoices.some((inv: any) =>
                        (inv.status === 'POSTED' || inv.status === 'PAID') &&
                        (inv.number === 'Draft' || !inv.number)
                    )
                },
                variant: 'destructive',
                badge: { type: 'warning', label: 'Solo sin folio' }
            },
            {
                id: 'delete-draft',
                label: 'Eliminar Borrador',
                icon: Trash2,
                requiredPermissions: ['billing.delete_invoice'],
                checkAvailability: (order) => {
                    // Show only if order is DRAFT and has no physical/financial impact
                    if (order.status !== 'DRAFT') return false

                    // Check for confirmed receipts (backend will block)
                    const hasConfirmedReceipts = order.related_documents?.receipts?.some(
                        (rec: any) => rec.status === 'CONFIRMED'
                    ) || false

                    // Check for posted payments (backend will block)
                    const hasPostedPayments = order.related_documents?.payments?.some(
                        (pay: any) => pay.journal_entry?.state === 'POSTED'
                    ) || false

                    // Only show if no receipts or payments
                    return !hasConfirmedReceipts && !hasPostedPayments
                },
                variant: 'destructive'
            }
        ]
    }
}
