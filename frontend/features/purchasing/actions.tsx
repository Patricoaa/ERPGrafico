import type { ActionRegistry } from '@/types/actions'
import {
    FileText,
    Package,
    Banknote,
    History,
    FileBadge,
    X,
    Eye,
    FileEdit,
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
interface ActionDoc {
    dte_type?: string
    status?: string
    number?: string
    pending_amount?: string | number
    po_receiving_status?: string
    receiving_status?: string
    lines?: Array<Record<string, unknown>>
    items?: Array<Record<string, unknown>>
    invoices?: Array<Record<string, unknown>>
    related_documents?: { invoices?: Array<Record<string, unknown>>; receipts?: Array<Record<string, unknown>>; payments?: Array<Record<string, unknown>> }
    work_orders?: Array<Record<string, unknown>>
    serialized_payments?: Array<Record<string, unknown>>
    product?: { track_inventory?: boolean }
    [key: string]: unknown
}

export const purchaseOrderActions: ActionRegistry<ActionDoc> = {
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
                    return invoices.some((inv) => inv.status === 'DRAFT' || inv.number === 'Draft')
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

                    // Must have storable products (exclude orders that are purely services)
                    const lines = activeDoc.lines || activeDoc.items || []
                    const hasStorable = lines.some((l) =>
                        l.product_type === 'STORABLE' ||
                        (l.product && (l.product as Record<string, unknown>).track_inventory) ||
                        l.track_inventory
                    )
                    if (!hasStorable) return false

                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // [FIX] For Debit Note: Check if items are fully received based on Note lines
                        if (activeDoc.dte_type === 'NOTA_DEBITO') {
                            const totalOrdered = lines.reduce((acc: number, line) => acc + (Number(line.quantity ?? 0) || 0), 0)
                            const totalReceived = lines.reduce((acc: number, line) => acc + (Number(line.quantity_received ?? 0) || 0), 0)
                            return totalReceived < totalOrdered
                        }

                        return activeDoc.po_receiving_status !== 'RECEIVED'
                    }

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
                    // Show ONLY if it has services and is not fully received
                    const lines = order.lines || order.items || []
                    const hasServices = lines.some((l) => l.product_type === 'SERVICE')
                    if (!hasServices) return false

                    const hasPending = lines.some((l) => {
                        if (l.quantity_pending !== undefined) {
                            return Number(l.quantity_pending ?? 0) > 0
                        }
                        const total = Number(l.quantity ?? 0) || 0
                        const received = Number(l.quantity_received ?? l.received_quantity ?? 0) || 0
                        return received < total
                    })

                    return order.receiving_status !== 'RECEIVED' && hasPending
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
                            const totalOrdered = lines.reduce((acc: number, line) => acc + (Number(line.quantity ?? 0) || 0), 0)
                            const totalDelivered = lines.reduce((acc: number, line) => acc + (Number(line.quantity_received ?? 0) || 0), 0)
                            return totalDelivered < totalOrdered
                        }
                        return false
                    }

                    // Only if invoice is DRAFT
                    const hasDraftInvoice = activeDoc.related_documents?.invoices?.some(
                        (inv) => inv.status === 'DRAFT'
                    ) ?? false

                    // Only if has received stockable products
                    const lines = activeDoc.lines || activeDoc.items || []
                    const hasStockableReceived = lines.some((line) =>
                        (Number(line.quantity_received ?? 0) || 0) > 0 && (line.product as Record<string, unknown> | undefined)?.track_inventory
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
                requiredPermissions: ['treasury.add_treasurymovement'],
                // Removed specific requiredStatus to rely on financial state
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // Allow registration for any posted document with pending balance
                        const hasPendingAmount = (Number(activeDoc.pending_amount ?? 0) || 0) > 0
                        return hasPendingAmount && activeDoc.status !== 'CANCELLED' && activeDoc.status !== 'DRAFT' && activeDoc.dte_type !== 'NOTA_CREDITO'
                    }

                    // Show if there's a pending amount
                    const hasPendingAmount = (Number(activeDoc.pending_amount ?? 0) || 0) > 0
                    return hasPendingAmount && activeDoc.status !== 'CANCELLED'
                },
                badge: { type: 'pending' },
                excludedStatus: ['CANCELLED']
            },
            {
                id: 'register-payment-return',
                label: 'Devolver Pago',
                icon: DollarSign,
                requiredPermissions: ['treasury.add_treasurymovement'],
                 checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // For Purchase Credit Note, we expect a refund FROM supplier
                        if (activeDoc.dte_type === 'NOTA_CREDITO') {
                            const hasPendingAmount = (Number(activeDoc.pending_amount ?? 0) || 0) > 0
                            return hasPendingAmount && activeDoc.status !== 'CANCELLED'
                        }
                        return false
                    }

                    // Only if invoice is DRAFT
                    const hasDraftInvoice = activeDoc.related_documents?.invoices?.some(
                        (inv) => inv.status === 'DRAFT'
                    ) ?? false

                    // Only if has posted payments
                    const payments = activeDoc.related_documents?.payments || []
                    const hasPostedPayments = payments.some(
                        (pay) => (pay.journal_entry as Record<string, unknown> | undefined)?.state === 'POSTED'
                    )

                    return hasDraftInvoice && hasPostedPayments
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            },
            {
                id: 'payment-history',
                label: 'Historial de Pagos',
                icon: History,
                requiredPermissions: ['treasury.view_treasurymovement'],
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
                    // Show if there is any DTE associated with the order
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    const validDTEs = ['FACTURA', 'PURCHASE_INV', 'BOLETA', 'BOLETA_EXENTA']
                    return invoices.some((inv) => validDTEs.includes(inv.dte_type as string))
                },
                isDisabled: (order) => {
                    const invoices = order.related_documents?.invoices || order.invoices || []

                    const hasIssuedDTEWithFolio = invoices.some((inv) =>
                        inv.status !== 'DRAFT' &&
                        inv.number &&
                        inv.number !== 'Draft'
                    )

                    return !hasIssuedDTEWithFolio
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
                    // Show if there is any DTE associated with the order
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    const validDTEs = ['FACTURA', 'PURCHASE_INV', 'BOLETA', 'BOLETA_EXENTA']
                    return invoices.some((inv) => validDTEs.includes(inv.dte_type as string))
                },
                isDisabled: (order) => {
                    const invoices = order.related_documents?.invoices || order.invoices || []

                    const hasIssuedDTEWithFolio = invoices.some((inv) =>
                        inv.status !== 'DRAFT' &&
                        inv.number &&
                        inv.number !== 'Draft'
                    )

                    return !hasIssuedDTEWithFolio
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
                        (inv) => inv.status === 'DRAFT'
                    ) ?? false

                    // Only if has received stockable products
                    const hasStockableReceived = order.lines?.some((line) =>
                        (Number(line.quantity_received ?? 0) || 0) > 0 && (line.product as Record<string, unknown> | undefined)?.track_inventory
                    ) ?? false

                    return hasDraftInvoice && hasStockableReceived
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            },
            {
                id: 'register-payment-return',
                label: 'Devolver Pago',
                icon: DollarSign,
                requiredPermissions: ['treasury.add_treasurymovement'],
                checkAvailability: (order) => {
                    // Only if invoice is DRAFT
                    const hasDraftInvoice = order.related_documents?.invoices?.some(
                        (inv) => inv.status === 'DRAFT'
                    ) ?? false

                    // Only if has posted payments
                    const hasPostedPayments = order.related_documents?.payments?.some(
                        (pay) => (pay.journal_entry as Record<string, unknown> | undefined)?.state === 'POSTED'
                    ) ?? false

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
        actions: []
    }
}
