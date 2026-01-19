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
    DollarSign
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
                checkAvailability: (order) => {
                    // Show if there's any invoice without a real folio number
                    const invoices = order.related_documents?.invoices || order.invoices || []
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
                checkAvailability: (order) => {
                    // Show if not fully delivered
                    return order.delivery_status !== 'DELIVERED'
                },
                badge: { type: 'pending' }
            },
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
                    const lines = order.lines || order.items || []
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
                checkAvailability: (order) => {
                    // Show if there's a pending amount or order is not paid
                    const hasPendingAmount = (order.pending_amount ?? 0) > 0
                    return hasPendingAmount || (order.status !== 'PAID' && order.status !== 'CANCELLED')
                },
                badge: { type: 'pending' },
                excludedStatus: ['CANCELLED']
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
                    const payments = order.related_documents?.payments || []
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
                id: 'create-note',
                label: 'Crear Nota',
                icon: FileBadge,
                requiredPermissions: ['billing.add_invoice'],
                excludedStatus: ['DRAFT', 'CANCELLED'],
                checkAvailability: (order) => {
                    // Show if there's a posted invoice that's not a note
                    const hasValidInvoice = order.related_documents?.invoices?.some((inv: any) =>
                        inv.status !== 'DRAFT' &&
                        !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type)
                    )
                    return hasValidInvoice
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
