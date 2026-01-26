import type { ActionRegistry } from '@/types/actions'
import {
    FileText,
    Truck,
    Banknote,
    History,
    FileBadge,
    X,
    Ban,
    Eye,
    Package,
    Trash2,
    FileEdit,
    Hash,
    RotateCcw,
    PackageMinus,
    DollarSign,
    MinusCircle,
    PlusCircle
} from 'lucide-react'

/**
 * Sale Order Action Registry
 * Defines all available actions for sale orders with permission requirements
 */
export const saleOrderActions: ActionRegistry = {
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
            },
            {
                id: 'regenerate-document',
                label: 'Re-emitir Documento',
                icon: FileEdit,
                requiredPermissions: ['billing.add_invoice'],
                checkAvailability: (order) => {
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    return invoices.length > 0 && invoices.every((inv: any) =>
                        inv.status === 'CANCELLED'
                    )
                },
                badge: { type: 'warning', label: 'Acción Requerida' }
            }
        ]
    },

    production: {
        id: 'production',
        label: 'Producción',
        icon: Package,
        actions: [
            {
                id: 'create-work-order',
                label: 'Crear OT Manual',
                icon: FileEdit,
                requiredPermissions: ['manufacturing.add_workorder'],
                checkAvailability: (order) => {
                    const lines = order.lines || order.items || []
                    const hasManufacturable = lines.some((l: any) => l.is_manufacturable)
                    const ots = order.work_orders || []
                    const noActiveOts = ots.length === 0 || ots.every((ot: any) => ot.status === 'CANCELLED')

                    return hasManufacturable && noActiveOts
                }
            }
        ]
    },

    deliveries: {
        id: 'deliveries',
        label: 'Despachos',
        icon: Truck,
        actions: [
            {
                id: 'register-delivery',
                label: 'Registrar Despacho',
                icon: Package,
                requiredPermissions: ['inventory.add_stockmove'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // For Debit Note or Invoice, we want to allow registering delivery if the order is pending
                        // Use order_delivery_status from the invoice serializer
                        return activeDoc.order_delivery_status !== 'DELIVERED'
                    }

                    // Show if not fully delivered
                    return activeDoc.delivery_status !== 'DELIVERED'
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
                        // For Credit Note, "Deolver Mercadería" is a primary action if pending
                        if (activeDoc.dte_type === 'NOTA_CREDITO') {
                            const lines = activeDoc.lines || []
                            const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
                            const totalDelivered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity_delivered || 0) || 0), 0)
                            return totalDelivered < totalOrdered
                        }
                        return false
                    }

                    // Only if invoice is DRAFT
                    const hasDraftInvoice = activeDoc.related_documents?.invoices?.some(
                        (inv: any) => inv.status === 'DRAFT'
                    )

                    // Only if has delivered stockable products
                    const lines = activeDoc.lines || activeDoc.items || []
                    const hasStockableDelivered = lines.some((line: any) =>
                        (line.quantity_delivered || 0) > 0 && line.product?.track_inventory
                    )

                    return hasDraftInvoice && hasStockableDelivered
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            },
            {
                id: 'view-deliveries',
                label: 'Ver Despachos',
                icon: Eye,
                requiredPermissions: ['inventory.view_stockmove'],
                checkAvailability: (order) => {
                    return (order.related_documents?.deliveries?.length || 0) > 0
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
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // Allow registration for any posted document with pending balance
                        const hasPendingAmount = (parseFloat(activeDoc.pending_amount) ?? 0) > 0
                        return hasPendingAmount && activeDoc.status !== 'CANCELLED' && activeDoc.status !== 'DRAFT'
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
                        // For Credit Note, this IS the primary treasury action
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
            }
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
                    // Only show if there's a FACTURA (not BOLETA)
                    const hasFactura = order.related_documents?.invoices?.some((inv: any) =>
                        inv.dte_type === 'FACTURA'
                    )
                    // Don't show if there are any boletas (fiscal restriction)
                    const hasBoleta = order.related_documents?.invoices?.some((inv: any) =>
                        inv.dte_type === 'BOLETA'
                    )
                    return hasFactura && !hasBoleta
                },
                isDisabled: (order) => {
                    const invoices = order.related_documents?.invoices || []

                    const hasIssuedFacturaWithFolio = invoices.some((inv: any) =>
                        inv.status !== 'DRAFT' &&
                        inv.dte_type === 'FACTURA' &&
                        inv.number &&
                        inv.number !== 'Draft'
                    )

                    // Relaxed rules: Only require a posted invoice with folio
                    return !hasIssuedFacturaWithFolio
                },
                disabledTooltip: (order) => {
                    if (order.status !== 'PAID') return "La orden debe estar completamente pagada"
                    if (order.delivery_status !== 'DELIVERED') return "La logística debe estar completamente finalizada"
                    return "Debe existir una factura publicada con folio asignado"
                }
            },
            {
                id: 'create-debit-note',
                label: 'Crear Nota de Débito',
                icon: PlusCircle,
                requiredPermissions: ['billing.add_invoice'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (order) => {
                    if (!order) return false
                    // Only show if there's a FACTURA (not BOLETA)
                    const hasFactura = order.related_documents?.invoices?.some((inv: any) =>
                        inv.dte_type === 'FACTURA'
                    )
                    // Don't show if there are any boletas (fiscal restriction)
                    const hasBoleta = order.related_documents?.invoices?.some((inv: any) =>
                        inv.dte_type === 'BOLETA'
                    )
                    return hasFactura && !hasBoleta
                },
                isDisabled: (order) => {
                    const invoices = order.related_documents?.invoices || []

                    const hasIssuedFacturaWithFolio = invoices.some((inv: any) =>
                        inv.status !== 'DRAFT' &&
                        inv.dte_type === 'FACTURA' &&
                        inv.number &&
                        inv.number !== 'Draft'
                    )

                    return !hasIssuedFacturaWithFolio
                },
                disabledTooltip: (order) => {
                    if (order.status !== 'PAID') return "La orden debe estar completamente pagada"
                    if (order.delivery_status !== 'DELIVERED') return "La logística debe estar completamente finalizada"
                    return "Debe existir una factura publicada con folio asignado"
                }
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

                    // Only if has delivered stockable products
                    const hasStockableDelivered = order.lines?.some((line: any) =>
                        (line.quantity_delivered || 0) > 0 && line.product?.track_inventory
                    )

                    return hasDraftInvoice && hasStockableDelivered
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
                id: 'view-work-orders',
                label: 'Ver Órdenes de Trabajo',
                icon: Eye,
                requiredPermissions: ['manufacturing.view_workorder'],
                checkAvailability: (order) => (order.work_orders?.length || 0) > 0
            },
            {
                id: 'annul-document',
                label: 'Anular Documento',
                icon: Ban,
                requiredPermissions: ['billing.delete_invoice'],
                checkAvailability: (order) => {
                    // Only show for DRAFT invoices without folio
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    return invoices.some((inv: any) =>
                        inv.status === 'DRAFT' &&
                        (inv.number === 'Draft' || !inv.number)
                    )
                },
                variant: 'destructive',
                badge: { type: 'warning', label: 'Solo DRAFT' }
            },
            {
                id: 'delete-draft',
                label: 'Eliminar Borrador',
                icon: Trash2,
                requiredPermissions: ['billing.delete_invoice'],
                checkAvailability: (order) => {
                    // Show only if order is DRAFT and has no physical/financial impact
                    if (order.status !== 'DRAFT') return false

                    // Check for confirmed deliveries (backend will block)
                    const hasConfirmedDeliveries = order.related_documents?.deliveries?.some(
                        (del: any) => del.status === 'CONFIRMED'
                    ) || false

                    // Check for posted payments (backend will block)
                    const hasPostedPayments = order.related_documents?.payments?.some(
                        (pay: any) => pay.journal_entry?.state === 'POSTED'
                    ) || false

                    // Only show if no deliveries or payments
                    return !hasConfirmedDeliveries && !hasPostedPayments
                },
                variant: 'destructive'
            }
        ]
    }
}
