import type { ActionRegistry } from '@/types/actions'
import {
    FileText,
    Truck,
    Banknote,
    History,
    FileBadge,
    X,
    Eye,
    Package,
    FileEdit,
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
interface ActionDoc {
    dte_type?: string
    status?: string
    number?: string
    pending_amount?: string | number
    delivery_status?: string
    order_delivery_status?: string
    lines?: Array<Record<string, unknown>>
    items?: Array<Record<string, unknown>>
    invoices?: Array<Record<string, unknown>>
    related_documents?: { invoices?: Array<Record<string, unknown>>; deliveries?: Array<Record<string, unknown>>; payments?: Array<Record<string, unknown>> }
    work_orders?: Array<Record<string, unknown>>
    serialized_payments?: Array<Record<string, unknown>>
    product?: { track_inventory?: boolean }
    [key: string]: unknown
}

export const saleOrderActions: ActionRegistry<ActionDoc> = {
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
            },
            {
                id: 'regenerate-document',
                label: 'Re-emitir Documento',
                icon: FileEdit,
                requiredPermissions: ['billing.add_invoice'],
                checkAvailability: (order) => {
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    return invoices.length > 0 && invoices.every((inv: Record<string, unknown>) =>
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
                label: 'Crear Orden de Trabajo',
                icon: FileEdit,
                requiredPermissions: ['production.add_workorder'],
                checkAvailability: (order) => {
                    // Show if there is at least one line with advanced manufacturing pending
                    const lines = order.lines || order.items || []
                    return lines.some((l: Record<string, unknown>) =>
                        l.product_type === 'MANUFACTURABLE' &&
                        l.requires_advanced_manufacturing &&
                        !l.work_order_summary
                    )
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

                    // Hide for service-only orders — use confirm-service-delivery instead
                    const lines = activeDoc.lines || activeDoc.items || []
                    const allServices = lines.every((l: Record<string, unknown>) => l.product_type === 'SERVICE')
                    if (allServices) return false

                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        if (activeDoc.dte_type === 'NOTA_DEBITO') {
                            const totalOrdered = lines.reduce((acc: number, line) => acc + (Number(line.quantity ?? 0) || 0), 0)
                            const totalDelivered = lines.reduce((acc: number, line) => acc + (Number(line.quantity_delivered ?? 0) || 0), 0)
                            return totalDelivered < totalOrdered
                        }
                        return activeDoc.order_delivery_status !== 'DELIVERED'
                    }

                    return activeDoc.delivery_status !== 'DELIVERED'
                },
                badge: { type: 'pending' }
            },
            {
                id: 'confirm-service-delivery',
                label: 'Confirmar Entrega de Servicio',
                icon: FileBadge,
                requiredPermissions: ['inventory.add_stockmove'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const lines = activeDoc.lines || activeDoc.items || []
                    const hasServices = lines.some((l: Record<string, unknown>) => l.product_type === 'SERVICE')
                    if (!hasServices) return false

                    const hasPending = lines.some((l: Record<string, unknown>) => {
                        if (l.quantity_pending !== undefined) {
                        return Number(l.quantity_pending ?? 0) > 0
                        }
                        const total = Number(l.quantity ?? 0) || 0
                        const delivered = Number(l.quantity_delivered ?? l.delivered_quantity ?? 0) || 0
                        return delivered < total
                    })

                    return activeDoc.delivery_status !== 'DELIVERED' && hasPending
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
                            const totalOrdered = lines.reduce((acc: number, line) => acc + (Number(line.quantity ?? 0) || 0), 0)
                            const totalDelivered = lines.reduce((acc: number, line) => acc + (Number(line.quantity_delivered ?? 0) || 0), 0)
                            return totalDelivered < totalOrdered
                        }
                        return false
                    }

                    // Only if invoice is DRAFT
                    const hasDraftInvoice = activeDoc.related_documents?.invoices?.some(
                        (inv: Record<string, unknown>) => inv.status === 'DRAFT'
                    ) ?? false

                    // Only if has delivered stockable products
                    const lines = activeDoc.lines || activeDoc.items || []
                    const hasStockableDelivered = lines.some((line: Record<string, unknown>) =>
                        (Number(line.quantity_delivered ?? 0) || 0) > 0 && (line.product as Record<string, unknown> | undefined)?.track_inventory
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
                requiredPermissions: ['treasury.add_treasurymovement'],
                checkAvailability: (activeDoc) => {
                    if (!activeDoc) return false
                    const isInvoiced = !!activeDoc.dte_type

                    if (isInvoiced) {
                        // Allow registration for any posted document with pending balance
                        const hasPendingAmount = (Number(activeDoc.pending_amount ?? 0) || 0) > 0
                        // For ND, also allow in DRAFT if it corrections/additions are being paid early
                        return hasPendingAmount && activeDoc.status !== 'CANCELLED' && activeDoc.dte_type !== 'NOTA_CREDITO'
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
                        // For Credit Note, this IS the primary treasury action
                        if (activeDoc.dte_type === 'NOTA_CREDITO') {
                            const hasPendingAmount = (Number(activeDoc.pending_amount ?? 0) || 0) > 0
                            return hasPendingAmount && activeDoc.status !== 'CANCELLED'
                        }
                        return false
                    }

                    // Only if invoice is DRAFT
                    const hasDraftInvoice = activeDoc.related_documents?.invoices?.some(
                        (inv: Record<string, unknown>) => inv.status === 'DRAFT'
                    ) ?? false

                    // Only if has posted payments
                    const payments = activeDoc.related_documents?.payments || []
                    const hasPostedPayments = payments.some(
                        (pay: Record<string, unknown>) => (pay.journal_entry as Record<string, unknown> | undefined)?.state === 'POSTED'
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
                    // Show if there is any DTE associated with the order
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    const validDTEs = ['FACTURA', 'FACTURA_EXENTA', 'BOLETA', 'BOLETA_EXENTA']
                    return invoices.some((inv: Record<string, unknown>) => validDTEs.includes(inv.dte_type as string))
                },
                isDisabled: (order) => {
                    const invoices = order.related_documents?.invoices || order.invoices || []

                    const hasIssuedDTEWithFolio = invoices.some((inv: Record<string, unknown>) =>
                        inv.status !== 'DRAFT' &&
                        inv.number &&
                        inv.number !== 'Draft'
                    )

                    return !hasIssuedDTEWithFolio
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
                    // Show if there is any DTE associated with the order
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    const validDTEs = ['FACTURA', 'FACTURA_EXENTA', 'BOLETA', 'BOLETA_EXENTA']
                    return invoices.some((inv: Record<string, unknown>) => validDTEs.includes(inv.dte_type as string))
                },
                isDisabled: (order) => {
                    const invoices = order.related_documents?.invoices || order.invoices || []

                    const hasIssuedDTEWithFolio = invoices.some((inv: Record<string, unknown>) =>
                        inv.status !== 'DRAFT' &&
                        inv.number &&
                        inv.number !== 'Draft'
                    )

                    return !hasIssuedDTEWithFolio
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
                        (inv: Record<string, unknown>) => inv.status === 'DRAFT'
                    ) ?? false

                    // Only if has delivered stockable products
                    const hasStockableDelivered = order.lines?.some((line: Record<string, unknown>) =>
                        (Number(line.quantity_delivered ?? 0) || 0) > 0 && (line.product as Record<string, unknown> | undefined)?.track_inventory
                    ) ?? false

                    return hasDraftInvoice && hasStockableDelivered
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
                        (inv: Record<string, unknown>) => inv.status === 'DRAFT'
                    ) ?? false

                    // Only if has posted payments
                    const hasPostedPayments = order.related_documents?.payments?.some(
                        (pay: Record<string, unknown>) => (pay.journal_entry as Record<string, unknown> | undefined)?.state === 'POSTED'
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
        actions: [
            {
                id: 'view-work-orders',
                label: 'Ver Órdenes de Trabajo',
                icon: Eye,
                requiredPermissions: ['production.view_workorder'],
                checkAvailability: (order) => (order.work_orders?.length || 0) > 0
            }
        ]
    }
}
